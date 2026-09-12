import { describe, expect, it, vi } from "vitest";
import type { Metafile } from "esbuild";
import {
  collectPackages,
  owningPackage,
  renderLicences,
  type ManifestReader,
  type OwnedPackage,
  type PackageManifest,
} from "../src/licences.js";

const leftPadManifest: PackageManifest = {
  name: "left-pad",
  version: "1.0.0",
  license: "MIT",
  repository: "https://github.com/x/left-pad",
};
const cfontsManifest: PackageManifest = {
  name: "cfonts",
  version: "3.3.1",
  license: "GPL-3.0-or-later",
  repository: { url: "https://github.com/dominikwilkowski/cfonts" },
};

const tree: Record<string, PackageManifest> = {
  "/repo/node_modules/left-pad/package.json": leftPadManifest,
  // A nested build folder with a stub manifest: the walk must step past it.
  "/repo/node_modules/cfonts/lib/package.json": { name: "internal" },
  "/repo/node_modules/cfonts/package.json": cfontsManifest,
};

const reader: ManifestReader = (file) => tree[file] ?? null;

const metafile = (...inputs: string[]) =>
  ({ inputs: Object.fromEntries(inputs.map((i) => [i, {}])), outputs: {} }) as unknown as Metafile;

describe("owningPackage", () => {
  it("finds the manifest that owns a file", () => {
    const owner = owningPackage("node_modules/left-pad/index.js", "/repo", reader);
    expect(owner?.pkg.name).toBe("left-pad");
  });

  // A nested manifest without a version is a build artefact, not the owner.
  it("walks past a manifest missing name or version", () => {
    const owner = owningPackage("node_modules/cfonts/lib/GetFont.js", "/repo", reader);
    expect(owner?.pkg.name).toBe("cfonts");
    expect(owner?.dir).toBe("/repo/node_modules/cfonts");
  });

  it("returns null when nothing owns the file", () => {
    expect(owningPackage("node_modules/ghost/index.js", "/repo", reader)).toBeNull();
  });
});

describe("collectPackages", () => {
  it("ignores first-party sources", () => {
    const packages = collectPackages(
      metafile("scripts/run-cv-web/browser/entry.ts", "node_modules/left-pad/index.js"),
      "/repo",
      reader,
    );
    expect([...packages.keys()]).toEqual(["left-pad@1.0.0"]);
  });

  it("dedupes many files from one package", () => {
    const packages = collectPackages(
      metafile("node_modules/cfonts/lib/GetFont.js", "node_modules/cfonts/lib/other.js"),
      "/repo",
      reader,
    );
    expect([...packages.keys()]).toEqual(["cfonts@3.3.1"]);
  });
});

describe("renderLicences", () => {
  const packages = new Map<string, OwnedPackage>([
    [
      "left-pad@1.0.0",
      { dir: "/repo/node_modules/left-pad", pkg: leftPadManifest },
    ],
    [
      "cfonts@3.3.1",
      { dir: "/repo/node_modules/cfonts", pkg: cfontsManifest },
    ],
  ]);
  const text = async () => "FULL GPL TEXT";

  it("lists every package with its licence and repository, sorted", () => {
    return renderLicences(packages, text).then((out) => {
      const lines = out.split("\n").filter((l) => l.includes("@"));
      expect(lines[0]).toContain("cfonts@3.3.1");
      expect(lines[0]).toContain("GPL-3.0-or-later");
      expect(lines[1]).toContain("left-pad@1.0.0  MIT  https://github.com/x/left-pad");
    });
  });

  it("reads the repository url out of the object form", async () => {
    const out = await renderLicences(packages, text);
    expect(out).toContain("https://github.com/dominikwilkowski/cfonts");
  });

  // Distributing GPL code obliges us to carry its terms and point at the source.
  it("inlines the full text for copyleft licences only", async () => {
    const out = await renderLicences(packages, text);
    expect(out).toContain("FULL GPL TEXT");
    expect(out).toContain("===== cfonts@3.3.1 (GPL-3.0-or-later) — source:");
    expect(out).not.toContain("===== left-pad");
  });

  it("only reads licence text for the copyleft package", async () => {
    const spy = vi.fn(text);
    await renderLicences(packages, spy);
    expect(spy).toHaveBeenCalledOnce();
  });

  it("still lists a copyleft package whose licence file is missing", async () => {
    const out = await renderLicences(packages, async () => null);
    expect(out).toContain("cfonts@3.3.1");
    expect(out).not.toContain("=====");
  });

  it("renders a missing licence field as UNKNOWN rather than crashing", async () => {
    const odd = new Map<string, OwnedPackage>([
      ["mystery@1.0.0", { dir: "/x", pkg: { name: "mystery", version: "1.0.0" } }],
    ]);
    expect(await renderLicences(odd, text)).toContain('mystery@1.0.0  "UNKNOWN"');
  });
});
