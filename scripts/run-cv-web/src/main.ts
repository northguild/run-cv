// Builds run-cv for the browser: the run-cv program, bundled with Node shims
// and rendered into xterm.js. Output goes to the configured outDir (generated,
// git-ignored) and is served as a static page. Nothing runs on a server,
// nothing is fetched from npm at runtime, and there is no shell: the page runs
// exactly one program.
//
//   node scripts/run-cv-web/build.mjs

import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { build } from "esbuild";
import userConfig from "../run-cv-web.config.js";
import { toBrowserConfig } from "./config.js";
import { collectHumanFilesByHuman, mergeHumanFiles } from "./human-files.js";
import { collectPackages, renderLicences } from "./licences.js";
import { formatBuildSummary } from "./log.js";
import {
  createBuiltinFilter,
  createBuiltins,
  createStubFilter,
  createStubs,
} from "./module-map.js";
import { renderPage } from "./page.js";
import { pdfsFor, planPayloads } from "./payloads.js";
import { createShimsPlugin, programEntryFilter, sourceDirFilter } from "./shims-plugin.js";

const require = createRequire(import.meta.url);
const HERE = __RUN_CV_WEB_DIR__;
const ROOT = __REPO_ROOT__;
// RUN_CV_WEB_OUT lets the integration test build into a temp directory rather
// than over the real output.
const OUT = path.resolve(ROOT, process.env.RUN_CV_WEB_OUT ?? userConfig.outDir);

const shim = (name: string) => path.join(HERE, "browser", "shims", name);

/** Where the program and its humans' markdown come from, per `source`. */
function resolveSource(): { programEntry: string; humansDir: string } {
  if (userConfig.source.mode === "src") {
    const entry = path.resolve(ROOT, userConfig.source.entry);
    return { programEntry: entry, humansDir: path.join(path.dirname(entry), "humans") };
  }
  const dir = path.dirname(require.resolve(`${userConfig.source.packageName}/package.json`));
  return { programEntry: path.join(dir, "dist/cli.js"), humansDir: path.join(dir, "dist/humans") };
}

const { programEntry, humansDir } = resolveSource();

// A published package is one flat `dist/cli.js`; a checkout spreads the same
// program over several modules, more than one of which reads its own location.
const sourceFilter =
  userConfig.source.mode === "src"
    ? sourceDirFilter(path.dirname(programEntry))
    : programEntryFilter(programEntry);

const builtins = createBuiltins(shim, (id) => require.resolve(id));
const anonymous = userConfig.prompt.enabled;
const stubs = createStubs({
  shim,
  humans: userConfig.humans,
  homedir: userConfig.homedir,
  prompt: anonymous,
});

const filesByHuman = await collectHumanFilesByHuman(
  humansDir,
  userConfig.humans,
  userConfig.virtualDist,
);
// The whole anonymity property is this one ternary: under the prompt the
// bundle is seeded with nothing, and the markdown is written to per-human
// payloads below instead of being inlined into `terminal.js`.
const humanFiles = anonymous ? {} : mergeHumanFiles(filesByHuman);

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const result = await build({
  entryPoints: { terminal: path.join(HERE, "browser", "entry.ts") },
  outdir: OUT,
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  // Only needed when bundling a checkout: a published run-cv is already
  // compiled, but source `.tsx` still has JSX in it, and esbuild defaults to
  // the classic `React.createElement` runtime that run-cv does not import.
  jsx: "automatic",
  // RUN_CV_WEB_DEBUG=1 keeps names readable and adds source maps for debugging shims.
  minify: !process.env.RUN_CV_WEB_DEBUG,
  sourcemap: process.env.RUN_CV_WEB_DEBUG ? "inline" : false,
  metafile: true,
  legalComments: "none",
  define: { global: "globalThis", "process.env.NODE_ENV": '"production"' },
  inject: [shim("globals.ts")],
  plugins: [
    createShimsPlugin({
      shim,
      shimDir: path.join(HERE, "browser", "shims"),
      builtins,
      stubs,
      builtinFilter: createBuiltinFilter(builtins),
      stubFilter: createStubFilter(),
      programEntry,
      sourceFilter,
      virtualDist: userConfig.virtualDist,
      humanFiles,
      browserConfig: toBrowserConfig(userConfig),
    }),
  ],
  logLevel: "warning",
});

const template = await readFile(path.join(HERE, "index.html"), "utf8");
await writeFile(path.join(OUT, "index.html"), renderPage(template, userConfig));

if (anonymous) await writePayloads();

const packages = collectPackages(result.metafile, ROOT);
await writeFile(path.join(OUT, "THIRD_PARTY_LICENSES.txt"), await renderLicences(packages));

/**
 * One directory per human, named by the hash of their name: the markdown they
 * need and the PDFs their menu can ask for. Nothing here is reachable without
 * knowing the name, and nothing here names anybody else.
 */
async function writePayloads(): Promise<void> {
  const pdfSourceDir = path.resolve(ROOT, userConfig.pdfDir);
  let available: string[] = [];
  try {
    available = (await readdir(pdfSourceDir)).filter((file) => file.toLowerCase().endsWith(".pdf"));
  } catch {
    throw new Error(
      `run-cv-web: no PDF directory at ${pdfSourceDir}. The download menu asks for ` +
        "`<human>-<theme>-cv.pdf`, so run `pnpm build:pdfs` first or point `pdfDir` elsewhere.",
    );
  }

  const pdfsByHuman = new Map(
    userConfig.humans.map((human) => [human, pdfsFor(human, available)] as const),
  );
  const plans = await planPayloads(filesByHuman, pdfsByHuman, userConfig.hashSalt);

  for (const plan of plans) {
    const dir = path.join(OUT, userConfig.payloadDir, plan.hash);
    await mkdir(path.join(dir, "pdf"), { recursive: true });
    const payload = { human: plan.human, files: plan.files, pdfs: plan.pdfs };
    await writeFile(path.join(dir, "payload.json"), JSON.stringify(payload));
    for (const file of plan.pdfs) {
      await copyFile(path.join(pdfSourceDir, file), path.join(dir, "pdf", file));
    }
  }
}

if (process.env.RUN_CV_METAFILE) {
  await writeFile(process.env.RUN_CV_METAFILE, JSON.stringify(result.metafile, null, 2));
}

console.log(formatBuildSummary(result.metafile, ROOT, packages.size));
