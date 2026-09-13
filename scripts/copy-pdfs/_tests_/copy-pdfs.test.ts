import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { copyStaticPdfs } from "../copy-pdfs";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "run-cv-copy-pdfs-"));
}

describe("copyStaticPdfs", () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = makeTempDir();
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("copies PDF files from public into dist/pdf", () => {
    const publicDir = path.join(tempRoot, "public");
    const distPdfDir = path.join(tempRoot, "dist", "pdf");
    const writes: string[] = [];

    fs.mkdirSync(publicDir, { recursive: true });
    fs.writeFileSync(
      path.join(publicDir, "craig-terminal-cv.pdf"),
      "CRAIG PDF",
    );
    fs.writeFileSync(path.join(publicDir, "baldur-cv.pdf"), "BALDUR PDF");
    fs.writeFileSync(path.join(publicDir, "notes.txt"), "ignore me");

    const result = copyStaticPdfs({
      publicDir,
      distPdfDir,
      stdout: {
        write(chunk: string) {
          writes.push(chunk);
          return true;
        },
      },
    });

    expect(result.copiedFiles.sort()).toEqual([
      "baldur-cv.pdf",
      "craig-terminal-cv.pdf",
    ]);
    expect(result.removedFiles).toEqual([]);
    expect(
      fs.readFileSync(path.join(distPdfDir, "craig-terminal-cv.pdf"), "utf8"),
    ).toBe("CRAIG PDF");
    expect(
      fs.readFileSync(path.join(distPdfDir, "baldur-cv.pdf"), "utf8"),
    ).toBe("BALDUR PDF");
    expect(fs.existsSync(path.join(distPdfDir, "notes.txt"))).toBe(false);
    expect(writes).toEqual([
      `Copied 2 static PDF file(s) to ${path.resolve(distPdfDir)}\n`,
    ]);
  });

  // run-cv shows a static download only when its file is packaged, so a CV
  // deleted from public/ must not survive in dist/pdf/ from an earlier build.
  it("removes PDFs from dist/pdf that are no longer in public", () => {
    const publicDir = path.join(tempRoot, "public");
    const distPdfDir = path.join(tempRoot, "dist", "pdf");
    const writes: string[] = [];

    fs.mkdirSync(publicDir, { recursive: true });
    fs.mkdirSync(distPdfDir, { recursive: true });
    fs.writeFileSync(path.join(publicDir, "baldur-cv.pdf"), "BALDUR PDF");
    fs.writeFileSync(path.join(distPdfDir, "nobody-cv.pdf"), "STALE");
    fs.writeFileSync(path.join(distPdfDir, "keep.txt"), "not a pdf");

    const result = copyStaticPdfs({
      publicDir,
      distPdfDir,
      stdout: {
        write(chunk: string) {
          writes.push(chunk);
          return true;
        },
      },
    });

    expect(result.removedFiles).toEqual(["nobody-cv.pdf"]);
    expect(fs.existsSync(path.join(distPdfDir, "nobody-cv.pdf"))).toBe(false);
    expect(fs.existsSync(path.join(distPdfDir, "baldur-cv.pdf"))).toBe(true);
    expect(fs.existsSync(path.join(distPdfDir, "keep.txt"))).toBe(true);
    expect(writes).toContain("Removed 1 stale PDF file(s): nobody-cv.pdf\n");
  });

  it("throws when the public directory is missing", () => {
    const publicDir = path.join(tempRoot, "missing-public");
    const distPdfDir = path.join(tempRoot, "dist", "pdf");

    expect(() => copyStaticPdfs({ publicDir, distPdfDir })).toThrow(
      `Public directory not found: ${path.resolve(publicDir)}`,
    );
  });

  it("throws when the public directory has no PDF files", () => {
    const publicDir = path.join(tempRoot, "public");
    const distPdfDir = path.join(tempRoot, "dist", "pdf");

    fs.mkdirSync(publicDir, { recursive: true });
    fs.writeFileSync(path.join(publicDir, "notes.txt"), "ignore me");

    expect(() => copyStaticPdfs({ publicDir, distPdfDir })).toThrow(
      `No PDF files found in ${path.resolve(publicDir)}`,
    );
  });
});
