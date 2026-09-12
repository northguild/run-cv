// The esbuild plugin that turns a Node CLI into a browser bundle.
//
// Everything here is resolution and source rewriting; keeping it in one place
// (and free of filesystem writes beyond reading the files it rewrites) is what
// lets the tests drive it with a fake PluginBuild.
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Plugin, PluginBuild } from "esbuild";
import type { HumanFiles } from "./human-files.js";
import type { BrowserConfig } from "./config.js";

export interface ShimsPluginOptions {
  /** Absolute path to a shim file, by name. */
  shim: (name: string) => string;
  /** Directory the shim files live in, used as esbuild's resolveDir for stubs. */
  shimDir: string;
  builtins: Record<string, string>;
  stubs: Record<string, string>;
  builtinFilter: RegExp;
  stubFilter: RegExp;
  /** Absolute path to the run-cv entry module being bundled. */
  programEntry: string;
  /**
   * Which files get the `import.meta.url` rewrite. A bundled npm package is one
   * flat `dist/cli.js`, so the entry alone is enough; a checkout's source reads
   * its own location from several modules, so it needs the whole directory.
   */
  sourceFilter: RegExp;
  /** Where run-cv believes it lives inside the in-memory filesystem. */
  virtualDist: string;
  humanFiles: HumanFiles;
  browserConfig: BrowserConfig;
}

export const VIRTUAL_FILES = "virtual:run-cv-files";
export const VIRTUAL_CONFIG = "virtual:run-cv-web-config";
/** The indirection that lets the entry import the program without knowing where it is. */
export const PROGRAM_ALIAS = "run-cv-program";

export function createShimsPlugin(options: ShimsPluginOptions): Plugin {
  const {
    shim,
    shimDir,
    builtins,
    stubs,
    builtinFilter,
    stubFilter,
    programEntry,
    sourceFilter,
    virtualDist,
    humanFiles,
    browserConfig,
  } = options;

  return {
    name: "run-cv-browser-shims",
    setup(build: PluginBuild) {
      build.onResolve({ filter: builtinFilter }, (args) => {
        const name = args.path.replace(/^node:/, "");
        const builtin = builtins[name];
        return builtin ? { path: builtin } : { path: name, namespace: "stub" };
      });

      build.onResolve({ filter: stubFilter }, (args) => ({
        path: args.path.replace(/^#/, ""),
        namespace: "stub",
      }));

      build.onResolve({ filter: /^open$/ }, () => ({ path: shim("open.ts") }));

      // The entry imports the program under a stable alias so the config, not
      // the source, decides whether that is an npm package or a checkout.
      build.onResolve({ filter: new RegExp(`^${PROGRAM_ALIAS}$`) }, () => ({ path: programEntry }));

      // run-cv's own `ink` import goes through a wrapper that ends the session
      // cleanly. The wrapper's import of the real Ink is resolved from run-cv's
      // install location: with pnpm, `ink` is only visible to run-cv itself.
      build.onResolve({ filter: /^ink$/ }, (args) => {
        if (args.pluginData?.realInk) return undefined;
        if (args.importer === programEntry) return { path: shim("ink.ts") };
        if (args.importer === shim("ink.ts")) {
          return build.resolve("ink", {
            kind: args.kind,
            resolveDir: path.dirname(programEntry),
            pluginData: { realInk: true },
          });
        }
        return undefined;
      });

      build.onResolve({ filter: new RegExp(`^${VIRTUAL_FILES}$`) }, () => ({
        path: "files",
        namespace: "virtual",
      }));
      build.onResolve({ filter: new RegExp(`^${VIRTUAL_CONFIG}$`) }, () => ({
        path: "config",
        namespace: "virtual",
      }));

      build.onLoad({ filter: /.*/, namespace: "stub" }, (args) => ({
        contents: stubs[args.path],
        loader: "js" as const,
        resolveDir: shimDir,
      }));

      build.onLoad({ filter: /.*/, namespace: "virtual" }, (args) => ({
        contents:
          args.path === "files"
            ? `export default ${JSON.stringify(humanFiles)};`
            : `export default ${JSON.stringify(browserConfig)};`,
        loader: "js" as const,
      }));

      // cfonts loads fonts with a dynamic require the bundler can't follow.
      // run-cv only ever asks for "tiny", so make that one a static import.
      build.onLoad({ filter: /cfonts[\\/]lib[\\/]GetFont\.js$/ }, async (args) => ({
        contents: (await readFile(args.path, "utf8")).replace(
          // cfonts' own source text, matched verbatim to replace it — not a
          // template literal. Writing it as one would try to evaluate `font`,
          // which isn't in scope here, instead of matching this string.
          // biome-ignore lint/suspicious/noTemplateCurlyInString: literal source text being replaced, not an interpolation
          "require(path.normalize(`../fonts/${font}.json`))",
          '({ tiny: require("../fonts/tiny.json") })[font]',
        ),
        loader: "js" as const,
      }));

      // Tell run-cv it lives inside the in-memory filesystem.
      //
      // Every matched file is told it lives at `<virtualDist>/cli.js`, not at
      // its own path. That is deliberate: the npm build flattens the whole
      // program into one `dist/cli.js`, so a shared `__dirname` is the shape
      // run-cv is written against. `cvParser` then resolves
      // `<virtualDist>/humans`, where the markdown is seeded, and `App.tsx`
      // resolves `<virtualDist>/pdf`, which the `fs` shim intercepts.
      build.onLoad({ filter: sourceFilter }, async (args) => {
        // esbuild's filters are RE2 and have no negative lookahead, so the test
        // exclusion lives here. Nothing imports them, but a bundle that quietly
        // picked one up would be baffling.
        if (/__tests__|\.test\.tsx?$/.test(args.path)) return undefined;
        const extension = path.extname(args.path);
        return {
          contents: (await readFile(args.path, "utf8"))
            .replaceAll("import.meta.url", JSON.stringify(`file://${virtualDist}/cli.js`))
            .replace("importMeta: import.meta", "importMeta: {}"),
          loader:
            extension === ".tsx"
              ? ("tsx" as const)
              : extension === ".ts"
                ? ("ts" as const)
                : ("js" as const),
        };
      });
    },
  };
}

/** An exact-path filter, with regex metacharacters in the path escaped. */
export function programEntryFilter(entry: string): RegExp {
  return new RegExp(`^${escapeForFilter(entry)}$`);
}

/**
 * Every TypeScript file under a source directory. Used instead of
 * `programEntryFilter` when bundling a checkout rather than a published
 * package, because the program then reads its own location from more than just
 * the entry module.
 */
export function sourceDirFilter(dir: string): RegExp {
  return new RegExp(`^${escapeForFilter(dir)}[\\\\/].*\\.tsx?$`);
}

function escapeForFilter(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
