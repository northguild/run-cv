/** Virtual modules supplied by the esbuild plugin in `src/shims-plugin.ts`. */

/** The human's markdown, keyed by the path run-cv believes it was installed to. */
declare module "virtual:run-cv-files" {
  const files: Record<string, string>;
  export default files;
}

/** The browser-relevant subset of `run-cv-web.config.ts`, serialised at build time. */
declare module "virtual:run-cv-web-config" {
  import type { BrowserConfig } from "./src/config.js";
  const config: BrowserConfig;
  export default config;
}

/** xterm ships a stylesheet the entry imports for its side effect. */
declare module "*.css";

/**
 * The browser polyfills are imported with a trailing slash (`util/`, `buffer/`,
 * `events/`) so Node resolves the npm package rather than its own builtin.
 * They ship no types of their own, but their surface is the builtin's, so point
 * the compiler at that.
 */
declare module "util/" {
  export * from "node:util";
  export { default } from "node:util";
}

declare module "buffer/" {
  export * from "node:buffer";
  export { default } from "node:buffer";
}

declare module "events/" {
  export * from "node:events";
  export { default } from "node:events";
}

/**
 * Injected by `build.mjs` via esbuild `define`. The builder is compiled into a
 * cache directory before it runs, so `import.meta.url` would point there rather
 * than at this folder — these carry the real locations instead.
 */
declare const __RUN_CV_WEB_DIR__: string;
declare const __REPO_ROOT__: string;

/** The run-cv program, resolved by the plugin from `source` in the config. */
declare module "run-cv-program";

/**
 * `ink` belongs to run-cv, not to this folder, and pnpm keeps it visible only
 * to run-cv itself — the bundler resolves it from there (see `shims-plugin.ts`),
 * but the compiler has no path to its types. Declare the slice the wrapper uses.
 */
declare module "ink" {
  import type { ReactNode } from "react";
  export interface RenderOptions {
    patchConsole?: boolean;
    exitOnCtrlC?: boolean;
    [key: string]: unknown;
  }
  export interface Instance {
    waitUntilExit(): Promise<void>;
    unmount(): void;
    [key: string]: unknown;
  }
  export function render(tree: ReactNode, options?: RenderOptions): Instance;
  /** One of Ink's own components, here only to prove `export *` passes through. */
  export const Text: unknown;
}
