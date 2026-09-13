import { describe, expect, it } from "vitest";
import { hashHuman } from "../shared/human-hash.js";
import type { HumanFiles } from "../src/human-files.js";
import { pdfsFor, planPayloads } from "../src/payloads.js";

const SALT = "test-salt";

const files = (human: string): HumanFiles => ({
  [`/run-cv/dist/humans/${human}/introduction.md`]: `# ${human}`,
});

describe("planPayloads", () => {
  it("pairs each human with the hash their payload is served from", async () => {
    const plans = await planPayloads(
      new Map([["craig", files("craig")]]),
      new Map([["craig", ["craig-terminal-cv.pdf"]]]),
      SALT,
    );
    expect(plans).toHaveLength(1);
    expect(plans[0]?.hash).toBe(await hashHuman("craig", SALT));
    expect(plans[0]?.human).toBe("craig");
    expect(plans[0]?.pdfs).toEqual(["craig-terminal-cv.pdf"]);
  });

  it("keeps each human's files to themselves", async () => {
    const plans = await planPayloads(
      new Map([
        ["craig", files("craig")],
        ["baldur", files("baldur")],
      ]),
      new Map(),
      SALT,
    );
    expect(Object.keys(plans[0]?.files ?? {})).toEqual([
      "/run-cv/dist/humans/craig/introduction.md",
    ]);
    expect(Object.keys(plans[1]?.files ?? {})).toEqual([
      "/run-cv/dist/humans/baldur/introduction.md",
    ]);
  });

  it("gives every human a distinct directory", async () => {
    const plans = await planPayloads(
      new Map([
        ["craig", {}],
        ["baldur", {}],
      ]),
      new Map(),
      SALT,
    );
    expect(new Set(plans.map((p) => p.hash)).size).toBe(2);
  });

  it("tolerates a human with no PDFs rather than failing the build", async () => {
    const plans = await planPayloads(new Map([["craig", {}]]), new Map(), SALT);
    expect(plans[0]?.pdfs).toEqual([]);
  });
});

describe("pdfsFor", () => {
  // Baldur has an HR/ATS CV; Craig has only the themed ones.
  const available = [
    "craig-terminal-cv.pdf",
    "craig-vintage-cv.pdf",
    "baldur-cv.pdf",
    "baldur-terminal-cv.pdf",
    "baldur-vintage-cv.pdf",
    "notes.txt",
  ];

  it("picks every PDF run-cv's download menu can ask a human for", () => {
    // menu-actions builds `${human}-${theme}-cv.pdf`, plus the named ATS file.
    expect(pdfsFor("baldur", available)).toEqual([
      "baldur-cv.pdf",
      "baldur-terminal-cv.pdf",
      "baldur-vintage-cv.pdf",
    ]);
  });

  // The payload's list is what the browser uses to hide the ATS download, so a
  // human without that file must not be given one.
  it("leaves out an ATS CV the human doesn't have", () => {
    expect(pdfsFor("craig", available)).toEqual(["craig-terminal-cv.pdf", "craig-vintage-cv.pdf"]);
  });

  it("never hands one human another's PDFs", () => {
    expect(pdfsFor("craig", available).some((file) => file.startsWith("baldur"))).toBe(false);
  });

  it("matches the prefix case-insensitively, as run-cv lowercases the name", () => {
    expect(pdfsFor("CRAIG", ["craig-terminal-cv.pdf"])).toEqual(["craig-terminal-cv.pdf"]);
  });

  it("does not match a human whose name is a prefix of another", () => {
    expect(pdfsFor("cra", available)).toEqual([]);
  });
});
