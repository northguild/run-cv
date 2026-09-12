import { describe, expect, it } from "vitest";
import { DEFAULT_TERMINAL, defineRunCvWeb, toBrowserConfig } from "../src/config.js";

const base = { source: { mode: "package", packageName: "run-cv" } as const, humans: ["craig"] };

describe("defineRunCvWeb", () => {
  it("fills in the defaults a portfolio site wants", () => {
    const config = defineRunCvWeb(base);
    expect(config.outDir).toBe("public/run-cv");
    expect(config.basePath).toBe("/run-cv/");
    expect(config.virtualDist).toBe("/run-cv/dist");
    expect(config.homedir).toBe("/home/visitor");
    expect(config.terminal).toEqual(DEFAULT_TERMINAL);
  });

  it("derives a CV url from the base path when none is given", () => {
    expect(defineRunCvWeb({ ...base, basePath: "/x/" }).cvUrl).toBe("/x/cv.pdf");
  });

  it("merges a partial terminal config without dropping the rest", () => {
    const config = defineRunCvWeb({ ...base, terminal: { maxFont: 20 } });
    expect(config.terminal.maxFont).toBe(20);
    expect(config.terminal.minFont).toBe(DEFAULT_TERMINAL.minFont);
    expect(config.terminal.theme).toEqual(DEFAULT_TERMINAL.theme);
  });

  it("merges a partial theme", () => {
    const config = defineRunCvWeb({ ...base, terminal: { theme: { background: "#000" } } });
    expect(config.terminal.theme.background).toBe("#000");
    expect(config.terminal.theme.foreground).toBe(DEFAULT_TERMINAL.theme.foreground);
  });

  it("copies the humans list rather than aliasing the caller's array", () => {
    const humans = ["craig"];
    const config = defineRunCvWeb({ ...base, humans });
    humans.push("baldur");
    expect(config.humans).toEqual(["craig"]);
  });

  describe("rejects configurations that would fail silently at runtime", () => {
    it("an empty humans list", () => {
      expect(() => defineRunCvWeb({ ...base, humans: [] })).toThrow(/at least one human/);
    });

    // The name becomes both a filesystem path and a URL parameter.
    it("a human name that is not a safe slug", () => {
      for (const bad of ["../etc", "Craig", "cr aig", "", "craig/x"]) {
        expect(() => defineRunCvWeb({ ...base, humans: [bad] }), bad).toThrow(/invalid human name/);
      }
    });

    it("duplicate humans", () => {
      expect(() => defineRunCvWeb({ ...base, humans: ["craig", "craig"] })).toThrow(/duplicate/);
    });

    // A wrong basePath 404s every asset with no other symptom.
    it("a basePath without both slashes", () => {
      expect(() => defineRunCvWeb({ ...base, basePath: "run-cv/" })).toThrow(/must start and end/);
      expect(() => defineRunCvWeb({ ...base, basePath: "/run-cv" })).toThrow(/must start and end/);
    });

    it("an absolute source entry", () => {
      expect(() =>
        defineRunCvWeb({ ...base, source: { mode: "src", entry: "/abs/cli.tsx" } }),
      ).toThrow(/relative to the repo root/);
    });

    // Without a salt the page cannot derive any payload directory, so every
    // name would 404 and the terminal would be permanently locked.
    it("a prompt with no hash salt", () => {
      expect(() => defineRunCvWeb({ ...base, prompt: { enabled: true } })).toThrow(/hashSalt/);
    });

    it("a payloadDir that is not a single directory name", () => {
      for (const bad of ["a/b", "../h", ".hidden"]) {
        expect(
          () =>
            defineRunCvWeb({ ...base, prompt: { enabled: true }, hashSalt: "s", payloadDir: bad }),
          bad,
        ).toThrow(/single directory name/);
      }
    });

    it("a font range that is inside out", () => {
      expect(() => defineRunCvWeb({ ...base, terminal: { minFont: 20, maxFont: 10 } })).toThrow(
        /cannot exceed/,
      );
    });
  });
});

describe("toBrowserConfig", () => {
  it("passes through only what the browser half needs", () => {
    const browser = toBrowserConfig(defineRunCvWeb(base));
    expect(Object.keys(browser).sort()).toEqual([
      "cvUrl",
      "hashSalt",
      "homedir",
      "humans",
      "payloadBase",
      "prompt",
      "terminal",
      "virtualDist",
    ]);
  });

  // The allowlist is the one thing that must never reach the bundle: a single
  // JSON.stringify of it would put every name back into terminal.js and undo
  // the whole point of the prompt.
  it("omits the humans allowlist entirely when the prompt is enabled", () => {
    const gated = toBrowserConfig(
      defineRunCvWeb({
        ...base,
        humans: ["craig", "baldur"],
        prompt: { enabled: true },
        hashSalt: "s",
      }),
    );
    expect(gated).not.toHaveProperty("humans");
    expect(JSON.stringify(gated)).not.toMatch(/craig|baldur/);
  });

  it("points the browser at the payload directory", () => {
    const gated = defineRunCvWeb({
      ...base,
      basePath: "/x/",
      prompt: { enabled: true },
      hashSalt: "s",
    });
    expect(toBrowserConfig(gated).payloadBase).toBe("/x/h/");
  });

  it("does not leak build-only paths into the bundle", () => {
    const browser = toBrowserConfig(defineRunCvWeb(base)) as unknown as Record<string, unknown>;
    expect(browser.outDir).toBeUndefined();
    expect(browser.source).toBeUndefined();
  });
});
