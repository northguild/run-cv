// Entry point for the run-cv browser build.
//
// The builder itself is TypeScript. Rather than add a TS runner to this repo,
// it is compiled here with the esbuild the build already depends on, then
// imported. `packages: "external"` keeps that a fast transpile rather than a
// second real bundle.
//
//   node scripts/run-cv-web/build.mjs

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const compiled = path.join(ROOT, "node_modules/.cache/run-cv-web/main.mjs");

await mkdir(path.dirname(compiled), { recursive: true });

await build({
  entryPoints: [path.join(HERE, "src/main.ts")],
  outfile: compiled,
  bundle: true,
  format: "esm",
  platform: "node",
  // Matches the Node version CI pins, which is older than a typical dev machine.
  target: "node20",
  packages: "external",
  // The builder is compiled away from its own folder, so `import.meta.url`
  // cannot tell it where it lives. Inject the real locations instead.
  define: {
    __RUN_CV_WEB_DIR__: JSON.stringify(HERE),
    __REPO_ROOT__: JSON.stringify(ROOT),
  },
  logLevel: "warning",
});

await import(pathToFileURL(compiled).href);
