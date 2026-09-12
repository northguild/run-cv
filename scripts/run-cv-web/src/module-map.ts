// What each Node module becomes in the browser: a real shim, or a tiny virtual
// stub for things that have no meaning in a tab.
//
// Adding an entry here is only half the job — it must also be reachable by one
// of the filters below, or esbuild never asks the plugin about it and the real
// Node module gets bundled instead. `module-map.test.ts` enforces that.

/** Resolves a shim file name to an absolute path. */
export type ShimResolver = (name: string) => string;

/** Node built-ins with a real browser implementation. */
export function createBuiltins(
  shim: ShimResolver,
  resolve: (id: string) => string,
): Record<string, string> {
  return {
    fs: shim("fs.ts"),
    "fs/promises": shim("fs-promises.ts"),
    process: shim("process.ts"),
    path: resolve("path-browserify"),
    stream: resolve("stream-browserify"),
    events: resolve("events/"),
    buffer: resolve("buffer/"),
    util: shim("util.ts"),
  };
}

/** Built-ins that are stubbed rather than implemented. */
export const STUBBED_BUILTINS = ["os", "tty", "url", "child_process", "module", "crypto"] as const;

/** Bare package names that are stubbed. */
export const STUBBED_PACKAGES = [
  "signal-exit",
  "patch-console",
  "is-in-ci",
  "terminal-size",
  "meow",
  "supports-color",
  "ws",
  "react-devtools-core",
] as const;

export interface StubOptions {
  shim: ShimResolver;
  /** Humans whose CVs are bundled. More than one enables selection by URL. */
  humans: readonly string[];
  /** The home directory the in-memory filesystem presents. */
  homedir: string;
  /** When true the name comes from the gate at runtime, not from the build. */
  prompt: boolean;
}

/**
 * run-cv only uses meow to read the human's name from argv. A page has no argv,
 * so the name comes from the config: one human is fixed, several are selectable
 * with `?human=<name>` (or `#name`), validated against the allowlist so the
 * value can never reach the filesystem unchecked.
 */
function meowStub(options: StubOptions): string {
  const { humans, prompt, shim } = options;
  // Under the prompt the name is whatever the visitor typed, so it comes from
  // the session the gate filled in before the program was imported. Note no
  // name and no allowlist is interpolated here: one `JSON.stringify` of
  // `humans` would put both back into `terminal.js` and undo the anonymity.
  if (prompt) {
    return `import { currentHuman } from ${JSON.stringify(shim("session.ts"))};
    export default (help) => ({ input: [currentHuman()], flags: {}, unnormalizedFlags: {},
      pkg: { name: "run-cv" }, help, showHelp() {}, showVersion() {} });`;
  }
  const allowed = JSON.stringify(humans);
  const selection =
    humans.length === 1
      ? `const human = ${JSON.stringify(humans[0])};`
      : `const allowed = ${allowed};
    const asked = (new URLSearchParams(location.search).get("human") || location.hash.slice(1)).toLowerCase();
    const human = allowed.includes(asked) ? asked : allowed[0];`;
  return `export default (help) => {
    ${selection}
    return { input: [human], flags: {}, unnormalizedFlags: {},
      pkg: { name: "run-cv" }, help, showHelp() {}, showVersion() {} };
  };`;
}

/** Tiny virtual modules for things that have no meaning in a browser tab. */
export function createStubs(options: StubOptions): Record<string, string> {
  return {
    os: `export const homedir = () => ${JSON.stringify(options.homedir)}; export const tmpdir = () => "/tmp";
    export const platform = () => "linux"; export const type = () => "Linux"; export const release = () => "browser";
    export const hostname = () => "run-cv"; export const cpus = () => []; export const EOL = "\\n";
    export default { homedir, tmpdir, platform, type, release, hostname, cpus, EOL };`,
    tty: `export const isatty = () => true; export class ReadStream {} export class WriteStream {}
    export default { isatty, ReadStream, WriteStream };`,
    url: `export const fileURLToPath = (url) => {
      const href = String(url instanceof URL ? url.href : url);
      if (!href.startsWith("file://")) throw new TypeError("The URL must be of scheme file");
      return decodeURIComponent(href.slice("file://".length));
    };
    export const pathToFileURL = (p) => new URL("file://" + encodeURI(p));
    const URLImpl = globalThis.URL; const URLSearchParamsImpl = globalThis.URLSearchParams;
    export { URLImpl as URL, URLSearchParamsImpl as URLSearchParams };
    export default { fileURLToPath, pathToFileURL, URL: URLImpl, URLSearchParams: URLSearchParamsImpl };`,
    child_process: `const unavailable = () => { throw new Error("child_process is not available in the browser"); };
    export const exec = unavailable, execFile = unavailable, execFileSync = unavailable, execSync = unavailable,
      spawn = unavailable, spawnSync = unavailable;
    export default { exec, execFile, execFileSync, execSync, spawn, spawnSync };`,
    module: `export const createRequire = () => () => { throw new Error("require is not available in the browser"); };
    export default { createRequire };`,
    crypto: `export const randomUUID = () => globalThis.crypto.randomUUID();
    export const randomBytes = (size) => globalThis.crypto.getRandomValues(new Uint8Array(size));
    export const randomFillSync = (buffer) => globalThis.crypto.getRandomValues(buffer);
    export const createHash = () => { throw new Error("createHash is not available in the browser"); };
    export const webcrypto = globalThis.crypto;
    export default { randomUUID, randomBytes, randomFillSync, createHash, webcrypto };`,
    "signal-exit": `const onExit = () => () => {}; export { onExit }; export default onExit;`,
    "patch-console": `export default () => () => {};`,
    "is-in-ci": `export default false;`,
    "terminal-size": `import { stdout } from ${JSON.stringify(options.shim("process.ts"))};
    export default () => ({ columns: stdout.columns, rows: stdout.rows });`,
    meow: meowStub(options),
    // xterm.js renders truecolor in every browser; chalk's browser check would
    // otherwise turn colour off outside Chromium.
    "supports-color": `const level = { level: 3, hasBasic: true, has256: true, has16m: true };
    export const createSupportsColor = () => level;
    export const supportsColor = () => level; // cfonts calls it as a function
    export default { stdout: level, stderr: level, supportsColor };`,
    ws: `export class WebSocket {} export default {};`,
    "react-devtools-core": `export const connectToDevTools = () => {}; export default { connectToDevTools };`,
  };
}

/** Matches every Node built-in the plugin handles, with or without the `node:` prefix. */
export function createBuiltinFilter(builtins: Record<string, string>): RegExp {
  const names = [...Object.keys(builtins), ...STUBBED_BUILTINS].map((n) => n.replace("/", "\\/"));
  return new RegExp(`^(node:)?(${names.join("|")})$`);
}

/** Matches the stubbed bare packages. `#supports-color` is chalk's internal alias. */
export function createStubFilter(): RegExp {
  const names = STUBBED_PACKAGES.map((n) => (n === "supports-color" ? "#?supports-color" : n));
  return new RegExp(`^(${names.join("|")})$`);
}
