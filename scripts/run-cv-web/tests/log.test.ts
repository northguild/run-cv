import { describe, expect, it } from "vitest";
import type { Metafile } from "esbuild";
import { formatBuildSummary } from "../src/log.js";

const metafile = {
  inputs: {},
  outputs: {
    "/repo/public/run-cv/terminal.js": { bytes: 1_203_654 },
    "/repo/public/run-cv/terminal.css": { bytes: 3_596 },
  },
} as unknown as Metafile;

describe("formatBuildSummary", () => {
  it("reports each output relative to the repo, in KB, with the package count", () => {
    expect(formatBuildSummary(metafile, "/repo", 118)).toBe(
      "run-cv web build → public/run-cv/terminal.js 1175 KB, public/run-cv/terminal.css 4 KB · 118 bundled packages listed",
    );
  });

  it("handles a build with no outputs", () => {
    const empty = { inputs: {}, outputs: {} } as unknown as Metafile;
    expect(formatBuildSummary(empty, "/repo", 0)).toBe(
      "run-cv web build →  · 0 bundled packages listed",
    );
  });
});
