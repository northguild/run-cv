// Every package whose code ends up in the bundle is listed, and copyleft
// licences travel in full with a pointer back to their source.
import { existsSync, readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Metafile } from "esbuild";

export interface PackageManifest {
  name?: string;
  version?: string;
  license?: string | { type?: string };
  repository?: string | { url?: string };
}

export interface OwnedPackage {
  dir: string;
  pkg: PackageManifest;
}

/** Reads a package.json. Injectable so the walk can be tested without a tree. */
export type ManifestReader = (file: string) => PackageManifest | null;

const defaultReader: ManifestReader = (file) => {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as PackageManifest;
  } catch {
    return null;
  }
};

/**
 * Finds the package.json that owns a bundled file by walking up from it. A
 * manifest without both a name and a version is skipped: nested build folders
 * often carry a stub one, and stopping there would misattribute the file.
 */
export function owningPackage(
  file: string,
  root: string,
  readManifest: ManifestReader = defaultReader,
): OwnedPackage | null {
  let dir = path.dirname(path.resolve(root, file));
  while (dir !== path.dirname(dir)) {
    const pkg = readManifest(path.join(dir, "package.json"));
    if (pkg?.name && pkg.version) return { dir, pkg };
    dir = path.dirname(dir);
  }
  return null;
}

/** Every third-party package represented in the bundle, keyed `name@version`. */
export function collectPackages(
  metafile: Metafile,
  root: string,
  readManifest: ManifestReader = defaultReader,
): Map<string, OwnedPackage> {
  const packages = new Map<string, OwnedPackage>();
  for (const input of Object.keys(metafile.inputs)) {
    if (!input.includes("node_modules")) continue;
    const owner = owningPackage(input, root, readManifest);
    if (owner) packages.set(`${owner.pkg.name}@${owner.pkg.version}`, owner);
  }
  return packages;
}

const licenceOf = (pkg: PackageManifest): string =>
  typeof pkg.license === "string" ? pkg.license : JSON.stringify(pkg.license ?? "UNKNOWN");

const repositoryOf = (pkg: PackageManifest): string =>
  typeof pkg.repository === "string" ? pkg.repository : (pkg.repository?.url ?? "");

/** Reads a package's full licence text, for the copyleft ones. */
export type LicenceTextReader = (entry: OwnedPackage) => Promise<string | null>;

export const readLicenceFile: LicenceTextReader = async ({ dir }) => {
  const file = (await readdir(dir)).find((f) => /^licen[cs]e/i.test(f));
  return file ? await readFile(path.join(dir, file), "utf8") : null;
};

export async function renderLicences(
  packages: Map<string, OwnedPackage>,
  readLicenceText: LicenceTextReader = readLicenceFile,
): Promise<string> {
  const lines = [
    "run-cv in the browser — third-party software bundled into terminal.js / terminal.css",
    "Built from the run-cv npm package. Source for every package: https://www.npmjs.com/package/<name>",
    "",
  ];
  const fullTexts: string[] = [];

  for (const [id, entry] of [...packages].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const licence = licenceOf(entry.pkg);
    const repo = repositoryOf(entry.pkg);
    lines.push(`${id}  ${licence}  ${repo}`.trim());

    // Copyleft licences travel in full, with a pointer to the source.
    if (/GPL/i.test(licence)) {
      const text = await readLicenceText(entry);
      if (text) {
        const source = repo || `https://www.npmjs.com/package/${entry.pkg.name}`;
        fullTexts.push(`\n===== ${id} (${licence}) — source: ${source} =====\n\n${text}`);
      }
    }
  }

  return `${lines.join("\n")}\n${fullTexts.join("\n")}`;
}
