import { transform } from "esbuild";
import { describe, expect, it } from "vitest";
import {
  createBuiltinFilter,
  createBuiltins,
  createStubFilter,
  createStubs,
  STUBBED_BUILTINS,
  STUBBED_PACKAGES,
} from "../src/module-map.js";

const shim = (name: string) => `/shims/${name}`;
const resolve = (id: string) => `/node_modules/${id}`;

const builtins = createBuiltins(shim, resolve);
const builtinFilter = createBuiltinFilter(builtins);
const stubFilter = createStubFilter();
const stubs = createStubs({ shim, humans: ["craig"], homedir: "/home/visitor", prompt: false });

describe("createBuiltins", () => {
  it("maps the built-ins with a real implementation to shims or polyfills", () => {
    expect(builtins.fs).toBe("/shims/fs.ts");
    expect(builtins["fs/promises"]).toBe("/shims/fs-promises.ts");
    expect(builtins.path).toBe("/node_modules/path-browserify");
    expect(builtins.buffer).toBe("/node_modules/buffer/");
  });
});

describe("createBuiltinFilter", () => {
  it("matches built-ins with and without the node: prefix", () => {
    for (const name of [...Object.keys(builtins), ...STUBBED_BUILTINS]) {
      expect(builtinFilter.test(name), name).toBe(true);
      expect(builtinFilter.test(`node:${name}`), `node:${name}`).toBe(true);
    }
  });

  // `fs/promises` contains a slash, which is a regex metacharacter risk.
  it("matches the slashed built-in exactly", () => {
    expect(builtinFilter.test("fs/promises")).toBe(true);
    expect(builtinFilter.test("node:fs/promises")).toBe(true);
  });

  // Anchoring matters: a package whose name merely starts with a built-in's
  // must not be swallowed.
  it("does not match packages that merely look like built-ins", () => {
    for (const name of [
      "fs-extra",
      "path-browserify",
      "node-fetch",
      "crypto-js",
      "osenv",
      "url-parse",
    ]) {
      expect(builtinFilter.test(name), name).toBe(false);
    }
  });
});

describe("createStubFilter", () => {
  it("matches every stubbed package", () => {
    for (const name of STUBBED_PACKAGES) {
      expect(stubFilter.test(name), name).toBe(true);
    }
  });

  // chalk imports its own copy through a `#supports-color` subpath alias.
  it("matches chalk's internal alias for supports-color", () => {
    expect(stubFilter.test("#supports-color")).toBe(true);
  });

  it("does not match lookalikes", () => {
    for (const name of ["meow-helper", "wss", "terminal-size-x", "is-in-cider"]) {
      expect(stubFilter.test(name), name).toBe(false);
    }
  });
});

describe("the stub inventory", () => {
  // A stub no filter matches is dead code, and the real Node module gets
  // bundled in its place — silently, and usually fatally, in the browser.
  it("is entirely reachable by one of the two filters", () => {
    for (const name of Object.keys(stubs)) {
      expect(builtinFilter.test(name) || stubFilter.test(name), name).toBe(true);
    }
  });

  it("covers every name the filters can route to the stub namespace", () => {
    for (const name of [...STUBBED_BUILTINS, ...STUBBED_PACKAGES]) {
      expect(stubs[name], name).toBeTypeOf("string");
    }
  });

  it("never stubs a built-in that has a real implementation", () => {
    for (const name of Object.keys(builtins)) {
      expect(stubs[name], name).toBeUndefined();
    }
  });

  it("emits valid ESM for every stub", async () => {
    for (const [name, source] of Object.entries(stubs)) {
      await expect(transform(source, { loader: "js", format: "esm" }), name).resolves.toBeTruthy();
    }
  });

  it("gives every stub a default export, since that is how they are imported", () => {
    for (const [name, source] of Object.entries(stubs)) {
      expect(source, name).toMatch(/export default/);
    }
  });
});

describe("the os stub", () => {
  it("reports the configured home directory", () => {
    const custom = createStubs({
      shim,
      humans: ["craig"],
      homedir: "/somewhere/else",
      prompt: false,
    });
    expect(custom.os).toContain('homedir = () => "/somewhere/else"');
  });
});

describe("the meow stub", () => {
  it("hardcodes the only human when there is just one", () => {
    expect(stubs.meow).toContain('const human = "craig"');
    expect(stubs.meow).not.toContain("URLSearchParams");
  });

  it("reads the human from the URL when several are bundled", () => {
    const many = createStubs({
      shim,
      humans: ["craig", "baldur"],
      homedir: "/home/visitor",
      prompt: false,
    });
    expect(many.meow).toContain("URLSearchParams");
    expect(many.meow).toContain('["craig","baldur"]');
  });

  // The value reaches a filesystem path, so it is checked against the
  // allowlist rather than used as given.
  it("validates the requested human against the allowlist and falls back", () => {
    const many = createStubs({
      shim,
      humans: ["craig", "baldur"],
      homedir: "/home/visitor",
      prompt: false,
    });
    expect(many.meow).toContain("allowed.includes(asked) ? asked : allowed[0]");
  });
});

describe("the terminal-size stub", () => {
  it("reads the live size from the process shim rather than guessing", () => {
    expect(stubs["terminal-size"]).toContain('"/shims/process.ts"');
    expect(stubs["terminal-size"]).toContain("stdout.columns");
  });
});
