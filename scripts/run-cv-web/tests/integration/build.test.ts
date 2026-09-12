import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import config from "../../run-cv-web.config.js";
import { hashHuman } from "../../shared/human-hash.js";
import baseline from "../fixtures/module-graph.json" with { type: "json" };

const run = promisify(execFile);

const REPO = fileURLToPath(new URL("../../../../", import.meta.url));
const BUILD = path.join(REPO, "scripts/run-cv-web/build.mjs");

let out: string;
let terminal: string;
let licences: string;
let html: string;
let graph: string[];

/** pnpm store paths carry versions; compare package-relative paths instead. */
function normalise(input: string): string {
  return (
    /node_modules\/\.pnpm\/[^/]+\/node_modules\/(.+)$/.exec(input)?.[1] ??
    /node_modules\/(.+)$/.exec(input)?.[1] ??
    input
  );
}

beforeAll(async () => {
  out = await mkdtemp(path.join(tmpdir(), "run-cv-build-"));
  const metafile = path.join(out, "metafile.json");
  await run("node", [BUILD], {
    cwd: REPO,
    env: { ...process.env, RUN_CV_WEB_OUT: out, RUN_CV_METAFILE: metafile },
  });
  terminal = await readFile(path.join(out, "terminal.js"), "utf8");
  licences = await readFile(path.join(out, "THIRD_PARTY_LICENSES.txt"), "utf8");
  html = await readFile(path.join(out, "index.html"), "utf8");
  const meta = JSON.parse(await readFile(metafile, "utf8")) as {
    inputs: Record<string, unknown>;
  };
  graph = [...new Set(Object.keys(meta.inputs).map(normalise))].sort();
}, 120_000);

afterAll(async () => rm(out, { recursive: true, force: true }));

describe("the built page", () => {
  it("produces exactly the artifacts the page needs", async () => {
    const files = (await readdir(out)).filter((f) => f !== "metafile.json").sort();
    expect(files).toEqual(
      [
        "THIRD_PARTY_LICENSES.txt",
        config.payloadDir,
        "index.html",
        "terminal.css",
        "terminal.js",
      ].sort(),
    );
  });

  it("renders index.html with no token left behind", () => {
    expect(html).not.toMatch(/__[A-Z0-9_]+__/);
    expect(html).toContain(`href="${config.basePath}terminal.css"`);
    expect(html).toContain(`src="${config.basePath}terminal.js"`);
    expect(html).toContain(`<title>${config.page.title}</title>`);
  });
});

describe("the bundle", () => {
  // Any surviving node: specifier means a shim stopped matching and the page
  // will fail to load in a browser.
  it("contains no Node built-in specifiers", () => {
    expect(terminal).not.toMatch(/from\s*"node:/);
    expect(terminal).not.toMatch(/require\("node:/);
  });

  // The inverse of what this asserted before the gate, and the single most
  // important test here. Without it, a change that re-inlines the markdown
  // ships silently and the page looks completely fine.
  it("ships no markdown at all — the whole point of the prompt", () => {
    expect(terminal).not.toContain("/humans/craig/introduction.md");
    expect(terminal).not.toContain("/humans/baldur/introduction.md");
  });

  it("tells run-cv it lives in the in-memory filesystem", () => {
    expect(terminal).toContain(`file://${config.virtualDist}/cli.js`);
  });

  it("statically includes the cfonts font run-cv asks for", () => {
    expect(terminal).toMatch(/tiny/);
  });

  it("carries the browser config rather than hardcoded values", () => {
    expect(terminal).toContain(config.cvUrl);
  });

  // run-cv 0.2.3 removed these from contact.md. A content-only upstream release
  // is exactly how they would come back, and nothing else here would notice.
  it("contains none of the contact details upstream deliberately removed", () => {
    for (const secret of ["402558483", "6025356839", "craigocurtis@gmail.com"]) {
      expect(terminal, secret).not.toContain(secret);
    }
  });

  it("stays within the expected size band", async () => {
    const { size } = await stat(path.join(out, "terminal.js"));
    expect(size).toBeGreaterThan(800_000);
    expect(size).toBeLessThan(2_000_000);
  });
});

describe("anonymity", () => {
  const NAMES = [...config.humans, "Craig", "Baldur", "CRAIG"];

  it("names nobody in anything served before a name is typed", () => {
    for (const name of NAMES) {
      expect(terminal, `terminal.js leaks ${name}`).not.toContain(name);
      expect(html, `index.html leaks ${name}`).not.toContain(name);
    }
  });

  it("writes one payload per human, at the hash of their name", async () => {
    for (const human of config.humans) {
      const hash = await hashHuman(human, config.hashSalt);
      const file = path.join(out, config.payloadDir, hash, "payload.json");
      const payload = JSON.parse(await readFile(file, "utf8")) as {
        human: string;
        files: Record<string, string>;
      };
      expect(payload.human).toBe(human);
      expect(Object.keys(payload.files).length).toBeGreaterThan(0);
    }
  });

  it("keeps each payload to one person, so unlocking one reveals no other", async () => {
    for (const human of config.humans) {
      const hash = await hashHuman(human, config.hashSalt);
      const raw = await readFile(path.join(out, config.payloadDir, hash, "payload.json"), "utf8");
      for (const other of config.humans.filter((h) => h !== human)) {
        expect(raw, `${human}'s payload mentions ${other}`).not.toContain(`/humans/${other}/`);
      }
    }
  });

  it("serves every PDF the download menu can ask for, per human", async () => {
    for (const human of config.humans) {
      const hash = await hashHuman(human, config.hashSalt);
      const pdfs = await readdir(path.join(out, config.payloadDir, hash, "pdf"));
      // The ATS CV plus one per theme in scripts/pdf-gen/styles/themes.
      expect(pdfs.sort(), human).toEqual([
        `${human}-cv.pdf`,
        `${human}-terminal-cv.pdf`,
        `${human}-vintage-cv.pdf`,
      ]);
    }
  });
});

describe("the module graph", () => {
  // The real contract. A shim or stub that stops matching shows up here as a
  // Node module appearing, long before anyone loads the page.
  it("matches the committed baseline", () => {
    expect(graph).toEqual(baseline);
  });
});

describe("the licence manifest", () => {
  // The program is this repo's own source, not an npm package, so it is not in
  // the manifest. Its dependencies still are, and they are what the obligation
  // attaches to.
  it("lists the dependencies the program is bundled with", () => {
    for (const dependency of ["ink@", "react@", "cfonts@"]) {
      expect(licences, dependency).toContain(dependency);
    }
  });

  // Bundling GPL code obliges us to carry its terms and point at the source.
  it("inlines the full text of the copyleft licence it bundles", () => {
    expect(licences).toMatch(/cfonts@[\d.]+\s+GPL-3\.0/);
    expect(licences).toContain("GNU GENERAL PUBLIC LICENSE");
    expect(licences).toMatch(/=====.*source: /);
  });

  it("lists every bundled package once", () => {
    const ids = licences.split("\n").filter((l) => /^\S+@\d/.test(l));
    expect(ids.length).toBeGreaterThan(100);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
