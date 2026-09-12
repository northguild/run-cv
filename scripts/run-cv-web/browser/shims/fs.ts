// An in-memory filesystem holding only the human's markdown, at the path
// run-cv believes it was installed to.
import { createFsFromVolume, Volume } from "memfs";
import files from "virtual:run-cv-files";
import config from "virtual:run-cv-web-config";

export type MemFs = ReturnType<typeof createFsFromVolume>;

/**
 * run-cv's "download PDF" checks the bundled PDF exists, copies it to
 * ~/Downloads, then opens the copy. The PDFs aren't bundled into the page:
 * report them as present and skip the copy, and the `open` shim sends the
 * visitor to the site's own CV instead.
 */
export function isPackagedPdf(file: unknown, pdfDir: string): boolean {
  const value = String(file);
  return value.startsWith(`${pdfDir}/`) && value.toLowerCase().endsWith(".pdf");
}

export interface RunCvFsOptions {
  pdfDir: string;
  downloadsDir: string;
}

export interface RunCvFs {
  fs: MemFs;
  /**
   * Adds files after construction. `Volume.fromJSON` merges into the existing
   * volume rather than replacing it (`reset()` is the separate call that
   * clears), so this is additive and safe to call more than once.
   */
  seed(files: Record<string, string>): void;
}

export function createRunCvFs(contents: Record<string, string>, options: RunCvFsOptions): RunCvFs {
  const volume = Volume.fromJSON(contents);
  volume.mkdirSync(options.pdfDir, { recursive: true });
  volume.mkdirSync(options.downloadsDir, { recursive: true });

  const fs = createFsFromVolume(volume);
  const realExistsSync = fs.existsSync;
  const realCopyFileSync = fs.copyFileSync;

  fs.existsSync = ((file: unknown) =>
    isPackagedPdf(file, options.pdfDir) || realExistsSync(file as string)) as typeof fs.existsSync;

  fs.copyFileSync = ((source: unknown, destination: unknown, mode?: number) =>
    isPackagedPdf(source, options.pdfDir)
      ? undefined
      : realCopyFileSync(source as string, destination as string, mode)) as typeof fs.copyFileSync;

  return { fs, seed: (more) => volume.fromJSON(more) };
}

// Under the gate `files` is empty and the markdown arrives at runtime, once a
// visitor types a name that hashes to a payload. An unseeded volume is the
// wrong-name path: run-cv finds no `introduction.md` and renders ACCESS DENIED.
const { fs, seed } = createRunCvFs(files, {
  pdfDir: `${config.virtualDist}/pdf`,
  downloadsDir: `${config.homedir}/Downloads`,
});

export { seed };
export default fs;
// Destructured rather than wrapped in arrows: these are overloaded signatures,
// and a `(...args) => fs.x(...args)` wrapper collapses them to the first
// overload. memfs binds its methods to the volume, and the PDF interception
// above is already applied, so these are the patched functions.
export const {
  promises,
  constants,
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  copyFileSync,
  mkdirSync,
} = fs;
