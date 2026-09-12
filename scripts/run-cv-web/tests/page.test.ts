import { describe, expect, it } from "vitest";
import { defineRunCvWeb } from "../src/config.js";
import { pageTokens, renderPage } from "../src/page.js";

const config = defineRunCvWeb({
  source: { mode: "package", packageName: "run-cv" },
  humans: ["craig"],
  basePath: "/term/",
  page: { title: "My CV", hint: "press q" },
});

describe("renderPage", () => {
  it("substitutes every known token", () => {
    const html = renderPage('<a href="__BASE_PATH__x.js">__TITLE__ __HINT__</a>', config);
    expect(html).toBe('<a href="/term/x.js">My CV press q</a>');
  });

  it("substitutes repeated tokens", () => {
    expect(renderPage("__BASE_PATH__|__BASE_PATH__", config)).toBe("/term/|/term/");
  });

  it("carries the terminal colours into the page's own CSS", () => {
    const html = renderPage("body{background:__BACKGROUND__;color:__FOREGROUND__}", config);
    expect(html).toBe(
      `body{background:${config.terminal.theme.background};color:${config.terminal.theme.foreground}}`,
    );
  });

  // A literal __TOKEN__ in the output is invisible until someone loads the page.
  it("throws on an unknown token instead of shipping it", () => {
    expect(() => renderPage("__NOPE__", config)).toThrow(/unknown token\(s\): NOPE/);
  });

  it("names every known token in the error, so the fix is obvious", () => {
    expect(() => renderPage("__NOPE__", config)).toThrow(/Known tokens: ACCENT, BACKGROUND/);
  });

  it("reports all unknown tokens at once", () => {
    expect(() => renderPage("__A1__ __B2__", config)).toThrow(/A1, B2/);
  });

  it("leaves text that merely resembles a token alone", () => {
    expect(renderPage("__lowercase__ and _SINGLE_", config)).toBe("__lowercase__ and _SINGLE_");
  });
});

describe("pageTokens", () => {
  it("exposes exactly the tokens index.html may use", () => {
    expect(Object.keys(pageTokens(config)).sort()).toEqual([
      "ACCENT",
      "BACKGROUND",
      "BASE_PATH",
      "BOOT_STATE",
      "CURSOR",
      "FOREGROUND",
      "HINT",
      "PROMPT_LABEL",
      "PROMPT_NOTE",
      "PROMPT_PLACEHOLDER",
      "TITLE",
    ]);
  });
});
