/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import type { DimensionProposer, SizableTerminal } from "../../browser/terminal-sizing.js";
import { pickFontSize } from "../../browser/terminal-sizing.js";

const BOUNDS = { maxFont: 14, minFont: 6, needColumns: 81, needRows: 47 };

/**
 * A stand-in for xterm: cell size scales with the font, so a fixed host gives
 * more columns and rows as the font shrinks — the relationship the real
 * implementation is reading off the terminal.
 */
function fakeTerminal(hostWidth: number, hostHeight: number) {
  const term: SizableTerminal = { options: { fontSize: undefined } };
  const fit: DimensionProposer = {
    proposeDimensions() {
      const size = term.options.fontSize ?? 14;
      return {
        cols: Math.floor(hostWidth / (size * 0.6)),
        rows: Math.floor(hostHeight / (size * 1.2)),
      };
    },
  };
  return { term, fit };
}

describe("pickFontSize", () => {
  it("keeps the largest font when the host is roomy", () => {
    const { term, fit } = fakeTerminal(2000, 2000);
    expect(pickFontSize(term, fit, BOUNDS)).toBe(BOUNDS.maxFont);
    expect(term.options.fontSize).toBe(BOUNDS.maxFont);
  });

  it("steps down until run-cv's 81x47 frame fits", () => {
    const { term, fit } = fakeTerminal(600, 600);
    const size = pickFontSize(term, fit, BOUNDS);
    expect(size).toBeLessThan(BOUNDS.maxFont);
    expect(size).toBeGreaterThanOrEqual(BOUNDS.minFont);
    const proposed = fit.proposeDimensions();
    expect(proposed?.cols).toBeGreaterThanOrEqual(BOUNDS.needColumns);
    expect(proposed?.rows).toBeGreaterThanOrEqual(BOUNDS.needRows);
  });

  it("bottoms out at minFont when the host is simply too small", () => {
    const { term, fit } = fakeTerminal(120, 120);
    expect(pickFontSize(term, fit, BOUNDS)).toBe(BOUNDS.minFont);
    expect(term.options.fontSize).toBe(BOUNDS.minFont);
  });

  it("treats an undefined proposal as not fitting rather than throwing", () => {
    const term: SizableTerminal = { options: {} };
    const fit: DimensionProposer = { proposeDimensions: () => undefined };
    expect(pickFontSize(term, fit, BOUNDS)).toBe(BOUNDS.minFont);
  });

  it("always leaves the chosen size on the terminal", () => {
    const { term, fit } = fakeTerminal(900, 900);
    const size = pickFontSize(term, fit, BOUNDS);
    expect(term.options.fontSize).toBe(size);
  });
});
