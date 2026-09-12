// Reads each human's markdown out of the source tree into the map memfs is
// seeded with, keyed by the path run-cv believes it was installed to.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

/** `{ virtualPath: contents }`, ready for `Volume.fromJSON`. */
export type HumanFiles = Record<string, string>;

/**
 * One flat map for every human, as the bundle's `virtual:run-cv-files` wants it.
 *
 * @param humansDir  Directory containing one folder per human.
 * @param humans     Which of them to bundle.
 * @param virtualDist Where run-cv believes its `dist` lives.
 */
export async function collectHumanFiles(
  humansDir: string,
  humans: readonly string[],
  virtualDist: string,
): Promise<HumanFiles> {
  return mergeHumanFiles(await collectHumanFilesByHuman(humansDir, humans, virtualDist));
}

/** Flattens per-human maps into the single map the bundle is seeded with. */
export function mergeHumanFiles(byHuman: ReadonlyMap<string, HumanFiles>): HumanFiles {
  return Object.assign({}, ...byHuman.values()) as HumanFiles;
}

/**
 * The same walk, kept separate per human. This is what the anonymous build
 * writes one payload per, so that no single file ever holds two people's CVs.
 */
export async function collectHumanFilesByHuman(
  humansDir: string,
  humans: readonly string[],
  virtualDist: string,
): Promise<Map<string, HumanFiles>> {
  const byHuman = new Map<string, HumanFiles>();

  for (const human of humans) {
    const files: HumanFiles = {};
    const base = path.join(humansDir, human);
    const root = path.posix.join(virtualDist, "humans", human);

    async function walk(dir: string): Promise<void> {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
          continue;
        }
        // Always POSIX inside the virtual filesystem, whatever the host uses.
        const relative = path.relative(base, full).split(path.sep).join("/");
        files[path.posix.join(root, relative)] = await readFile(full, "utf8");
      }
    }

    await walk(base);
    byHuman.set(human, files);
  }

  return byHuman;
}
