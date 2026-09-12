import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  OnLoadArgs,
  OnLoadResult,
  OnResolveArgs,
  OnResolveResult,
  PluginBuild,
} from "esbuild";
import {
  PROGRAM_ALIAS,
  VIRTUAL_CONFIG,
  VIRTUAL_FILES,
  createShimsPlugin,
  programEntryFilter,
  sourceDirFilter,
} from "../src/shims-plugin.js";
import { DEFAULT_PROMPT, DEFAULT_TERMINAL } from "../src/config.js";

type ResolveHandler = (
  args: OnResolveArgs,
) => OnResolveResult | undefined | null | Promise<OnResolveResult | undefined | null>;
type LoadHandler = (
  args: OnLoadArgs,
) => OnLoadResult | undefined | null | Promise<OnLoadResult | undefined | null>;

const PROGRAM = "/pkg/run-cv/dist/cli.js";
const shim = (name: string) => `/shims/${name}`;

/**
 * Records what the plugin registers so each callback can be driven directly.
 * Cheaper and far more precise than asserting against a whole bundle.
 */
function harness(overrides: Partial<Parameters<typeof createShimsPlugin>[0]> = {}) {
  const resolvers: { filter: RegExp; handler: ResolveHandler }[] = [];
  const loaders: { filter: RegExp; namespace: string; handler: LoadHandler }[] = [];
  const resolve = vi.fn(async () => ({ path: "/real/ink/index.js", errors: [], warnings: [] }));

  const build = {
    onResolve: (options: { filter: RegExp }, handler: ResolveHandler) =>
      resolvers.push({ filter: options.filter, handler }),
    onLoad: (options: { filter: RegExp; namespace?: string }, handler: LoadHandler) =>
      loaders.push({ filter: options.filter, namespace: options.namespace ?? "file", handler }),
    resolve,
  } as unknown as PluginBuild;

  createShimsPlugin({
    shim,
    shimDir: "/shims",
    builtins: { fs: "/shims/fs.ts", path: "/node_modules/path-browserify" },
    stubs: { os: "export default {};", meow: "export default () => {};" },
    builtinFilter: /^(node:)?(fs|path|os)$/,
    stubFilter: /^(#?supports-color|meow)$/,
    programEntry: overrides.programEntry ?? PROGRAM,
    // Follows programEntry unless a test is exercising the wider filter, which
    // is how the real build wires it for a `mode: "src"` checkout.
    sourceFilter: programEntryFilter(overrides.programEntry ?? PROGRAM),
    virtualDist: "/run-cv/dist",
    humanFiles: { "/run-cv/dist/humans/craig/introduction.md": "# INTRO" },
    browserConfig: {
      cvUrl: "/cv.pdf",
      homedir: "/home/visitor",
      virtualDist: "/run-cv/dist",
      humans: ["craig"],
      terminal: DEFAULT_TERMINAL,
      prompt: DEFAULT_PROMPT,
      payloadBase: "/run-cv/h/",
      hashSalt: "test-salt",
    },
    ...overrides,
  }).setup(build);

  const runResolve = (arg: Partial<OnResolveArgs> & { path: string }) => {
    const entry = resolvers.find((r) => r.filter.test(arg.path));
    return entry?.handler(arg as OnResolveArgs);
  };
  const runLoad = (arg: Partial<OnLoadArgs> & { path: string }) => {
    const namespace = arg.namespace ?? "file";
    const entry = loaders.find((l) => l.namespace === namespace && l.filter.test(arg.path));
    return entry?.handler({ ...arg, namespace } as OnLoadArgs);
  };
  return { runResolve, runLoad, resolvers, loaders, resolve };
}

let h: ReturnType<typeof harness>;
beforeEach(() => {
  h = harness();
});

describe("built-in resolution", () => {
  it("maps a built-in to its shim", async () => {
    expect(await h.runResolve({ path: "fs" })).toEqual({ path: "/shims/fs.ts" });
  });

  it("strips the node: prefix before looking up", async () => {
    expect(await h.runResolve({ path: "node:fs" })).toEqual({ path: "/shims/fs.ts" });
    expect(await h.runResolve({ path: "node:path" })).toEqual({
      path: "/node_modules/path-browserify",
    });
  });

  it("routes a built-in with no implementation to the stub namespace", async () => {
    expect(await h.runResolve({ path: "node:os" })).toEqual({ path: "os", namespace: "stub" });
  });
});

describe("stub resolution", () => {
  it("routes stubbed packages to the stub namespace", async () => {
    expect(await h.runResolve({ path: "meow" })).toEqual({ path: "meow", namespace: "stub" });
  });

  // chalk's `#supports-color` must land on the same stub as the bare name.
  it("strips the # from chalk's internal alias", async () => {
    expect(await h.runResolve({ path: "#supports-color" })).toEqual({
      path: "supports-color",
      namespace: "stub",
    });
  });
});

describe("the program alias", () => {
  // The entry says `import "run-cv-program"`, so the config decides whether
  // that is an npm package or a checkout without the entry changing.
  it("resolves to the configured program entry", async () => {
    expect(await h.runResolve({ path: PROGRAM_ALIAS })).toEqual({ path: PROGRAM });
  });
});

describe("ink resolution", () => {
  it("sends the program's own import to the wrapper", async () => {
    expect(await h.runResolve({ path: "ink", importer: PROGRAM })).toEqual({
      path: "/shims/ink.ts",
    });
  });

  // With pnpm, ink is only visible from run-cv's own directory.
  it("resolves the wrapper's import from the program's directory", async () => {
    await h.runResolve({ path: "ink", importer: "/shims/ink.ts", kind: "import-statement" });
    expect(h.resolve).toHaveBeenCalledWith("ink", {
      kind: "import-statement",
      resolveDir: path.dirname(PROGRAM),
      pluginData: { realInk: true },
    });
  });

  // Without this guard the resolve above would re-enter the same callback.
  it("stops recursing once pluginData marks the real ink", async () => {
    expect(
      await h.runResolve({ path: "ink", importer: "/shims/ink.ts", pluginData: { realInk: true } }),
    ).toBeUndefined();
    expect(h.resolve).not.toHaveBeenCalled();
  });

  it("leaves anyone else's ink import to esbuild", async () => {
    expect(await h.runResolve({ path: "ink", importer: "/other/module.js" })).toBeUndefined();
  });
});

describe("virtual modules", () => {
  it("serialises the human files", async () => {
    const result = await h.runLoad({ path: "files", namespace: "virtual" });
    expect(result?.contents).toContain("/run-cv/dist/humans/craig/introduction.md");
    expect(result?.loader).toBe("js");
  });

  it("serialises the browser config", async () => {
    const result = await h.runLoad({ path: "config", namespace: "virtual" });
    expect(result?.contents).toContain('"cvUrl":"/cv.pdf"');
  });

  it("registers both virtual specifiers", async () => {
    expect(await h.runResolve({ path: VIRTUAL_FILES })).toEqual({
      path: "files",
      namespace: "virtual",
    });
    expect(await h.runResolve({ path: VIRTUAL_CONFIG })).toEqual({
      path: "config",
      namespace: "virtual",
    });
  });
});

describe("stub loading", () => {
  it("serves the stub source with a resolveDir so its own imports resolve", async () => {
    const result = await h.runLoad({ path: "os", namespace: "stub" });
    expect(result).toEqual({ contents: "export default {};", loader: "js", resolveDir: "/shims" });
  });
});

describe("source rewrites", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "run-cv-plugin-"));
  });

  // cfonts builds the font path at runtime; the bundler cannot follow it.
  it("turns cfonts' dynamic font require into a static one", async () => {
    const file = path.join(dir, "cfonts", "lib", "GetFont.js");
    await writeFile(
      await mkdirFor(file),
      // The fixture stands in for cfonts' actual source text, matched
      // verbatim by the plugin — not a template literal in this test.
      // biome-ignore lint/suspicious/noTemplateCurlyInString: fixture text for the plugin's literal-string match, not an interpolation
      "const f = require(path.normalize(`../fonts/${font}.json`));",
    );
    const plugin = harness();
    const result = await plugin.runLoad({ path: file });
    expect(result?.contents).toContain('({ tiny: require("../fonts/tiny.json") })[font]');
    expect(result?.contents).not.toContain("path.normalize");
  });

  // run-cv reads its own location off import.meta.url to find the markdown.
  it("points the program at the in-memory filesystem", async () => {
    const file = path.join(dir, "cli.js");
    await writeFile(file, "const here = import.meta.url;\nconst m = { importMeta: import.meta };");
    const plugin = harness({ programEntry: file });
    const result = await plugin.runLoad({ path: file });
    expect(result?.contents).toContain('"file:///run-cv/dist/cli.js"');
    expect(result?.contents).toContain("importMeta: {}");
    expect(result?.contents).not.toContain("import.meta.url");
  });

  it("replaces every occurrence, not just the first", async () => {
    const file = path.join(dir, "cli.js");
    await writeFile(file, "a(import.meta.url); b(import.meta.url);");
    const plugin = harness({ programEntry: file });
    const result = await plugin.runLoad({ path: file });
    expect(result?.contents).not.toContain("import.meta.url");
  });

  // A repo bundling its own source hands the plugin TSX, not JS.
  it("rewrites every source file under the directory, not just the entry", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "run-cv-src-"));
    const parser = path.join(dir, "cvParser.ts");
    await writeFile(parser, "const d = fileURLToPath(import.meta.url);");
    const plugin = harness({
      programEntry: path.join(dir, "cli.tsx"),
      sourceFilter: sourceDirFilter(dir),
    });
    const result = await plugin.runLoad({ path: parser });
    expect(result?.contents).toContain('"file:///run-cv/dist/cli.js"');
    // A .ts file carrying type annotations breaks under the js loader.
    expect(result?.loader).toBe("ts");
  });

  it("leaves test files alone, so a stray one can never be rewritten into the bundle", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "run-cv-src-"));
    const spec = path.join(dir, "__tests__", "thing.test.ts");
    await mkdir(path.dirname(spec), { recursive: true });
    await writeFile(spec, "const d = import.meta.url;");
    const plugin = harness({
      programEntry: path.join(dir, "cli.tsx"),
      sourceFilter: sourceDirFilter(dir),
    });
    expect(await plugin.runLoad({ path: spec })).toBeUndefined();
  });

  it("loads a .tsx program entry with the tsx loader", async () => {
    const file = path.join(dir, "cli.tsx");
    await writeFile(file, "export const App = () => null;");
    const plugin = harness({ programEntry: file });
    expect((await plugin.runLoad({ path: file }))?.loader).toBe("tsx");
  });
});

describe("programEntryFilter", () => {
  it("matches the exact path", () => {
    expect(programEntryFilter("/a/b/cli.js").test("/a/b/cli.js")).toBe(true);
  });

  // A real path can contain regex metacharacters, e.g. pnpm's `+` in store dirs.
  it("escapes metacharacters rather than letting them act as a pattern", () => {
    const filter = programEntryFilter("/a/node_modules/.pnpm/pkg@1.0.0+build/cli.js");
    expect(filter.test("/a/node_modules/.pnpm/pkg@1.0.0+build/cli.js")).toBe(true);
    expect(filter.test("/aXnode_modules/.pnpm/pkg@1.0.0build/cli.js")).toBe(false);
  });
});

async function mkdirFor(file: string): Promise<string> {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(path.dirname(file), { recursive: true });
  return file;
}
