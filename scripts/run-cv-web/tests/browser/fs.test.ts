import { describe, expect, it } from "vitest";
import fs, { createRunCvFs, isPackagedPdf } from "../../browser/shims/fs.js";

const PDF_DIR = "/run-cv/dist/pdf";
const OPTIONS = { pdfDir: PDF_DIR, downloadsDir: "/home/visitor/Downloads" };

describe("isPackagedPdf", () => {
  it("matches PDFs inside the packaged directory, case-insensitively", () => {
    expect(isPackagedPdf(`${PDF_DIR}/craig-cv.pdf`, PDF_DIR)).toBe(true);
    expect(isPackagedPdf(`${PDF_DIR}/CRAIG-CV.PDF`, PDF_DIR)).toBe(true);
  });

  it("does not match non-PDFs in that directory", () => {
    expect(isPackagedPdf(`${PDF_DIR}/notes.txt`, PDF_DIR)).toBe(false);
  });

  it("does not match PDFs elsewhere — a real download must still behave normally", () => {
    expect(isPackagedPdf("/home/visitor/Downloads/craig-cv.pdf", PDF_DIR)).toBe(false);
    expect(isPackagedPdf(`${PDF_DIR}-other/craig-cv.pdf`, PDF_DIR)).toBe(false);
  });
});

describe("seeding", () => {
  it("starts empty under the gate, which is what makes a wrong name ACCESS DENIED", () => {
    const { fs: memfs } = createRunCvFs({}, OPTIONS);
    expect(memfs.existsSync("/run-cv/dist/humans/craig/introduction.md")).toBe(false);
  });

  it("makes markdown readable once the payload arrives", () => {
    const { fs: memfs, seed } = createRunCvFs({}, OPTIONS);
    seed({ "/run-cv/dist/humans/craig/introduction.md": "# HI" });
    expect(memfs.readFileSync("/run-cv/dist/humans/craig/introduction.md", "utf8")).toBe("# HI");
  });

  // Volume.fromJSON merges; reset() is the separate call that clears. If that
  // ever changed, seeding would silently wipe the directories run-cv needs.
  it("merges rather than replacing, keeping the directories created at construction", () => {
    const { fs: memfs, seed } = createRunCvFs({ "/a.md": "a" }, OPTIONS);
    seed({ "/b.md": "b" });
    expect(memfs.readFileSync("/a.md", "utf8")).toBe("a");
    expect(memfs.readFileSync("/b.md", "utf8")).toBe("b");
    expect(memfs.existsSync("/home/visitor/Downloads")).toBe(true);
  });

  it("keeps the PDF interception working on seeded content", () => {
    const { fs: memfs, seed } = createRunCvFs({}, OPTIONS);
    seed({ "/run-cv/dist/humans/craig/introduction.md": "# HI" });
    expect(memfs.existsSync(`${PDF_DIR}/craig-vintage-cv.pdf`)).toBe(true);
  });
});

describe("createRunCvFs", () => {
  it("exposes the seeded markdown at its virtual path", () => {
    const { fs: memfs } = createRunCvFs(
      { "/run-cv/dist/humans/craig/introduction.md": "# HI" },
      OPTIONS,
    );
    expect(memfs.readFileSync("/run-cv/dist/humans/craig/introduction.md", "utf8")).toBe("# HI");
  });

  it("creates the PDF and Downloads directories run-cv expects to exist", () => {
    const { fs: memfs } = createRunCvFs({}, OPTIONS);
    expect(memfs.statSync(PDF_DIR).isDirectory()).toBe(true);
    expect(memfs.statSync("/home/visitor/Downloads").isDirectory()).toBe(true);
  });

  // run-cv checks the packaged PDF exists before offering the download. The
  // PDFs are not bundled into the page, so the check has to pass anyway.
  it("reports packaged PDFs as present without them existing", () => {
    const { fs: memfs } = createRunCvFs({}, OPTIONS);
    expect(memfs.existsSync(`${PDF_DIR}/craig-cv.pdf`)).toBe(true);
    expect(memfs.existsSync(`${PDF_DIR}/missing.txt`)).toBe(false);
  });

  it("skips the copy of a packaged PDF instead of failing on the missing source", () => {
    const { fs: memfs } = createRunCvFs({}, OPTIONS);
    expect(() =>
      memfs.copyFileSync(`${PDF_DIR}/craig-cv.pdf`, "/home/visitor/Downloads/craig-cv.pdf"),
    ).not.toThrow();
    expect(memfs.existsSync("/home/visitor/Downloads/craig-cv.pdf")).toBe(false);
  });

  it("still copies ordinary files", () => {
    const { fs: memfs } = createRunCvFs({ "/a.md": "body" }, OPTIONS);
    memfs.copyFileSync("/a.md", "/home/visitor/Downloads/a.md");
    expect(memfs.readFileSync("/home/visitor/Downloads/a.md", "utf8")).toBe("body");
  });

  it("honours a different pdfDir, so the config drives the interception", () => {
    const { fs: memfs } = createRunCvFs({}, { pdfDir: "/elsewhere/pdf", downloadsDir: "/dl" });
    expect(memfs.existsSync("/elsewhere/pdf/x.pdf")).toBe(true);
    expect(memfs.existsSync(`${PDF_DIR}/x.pdf`)).toBe(false);
  });
});

describe("the default instance", () => {
  it("is built from the bundled human files", () => {
    expect(fs.readFileSync("/run-cv/dist/humans/craig/contact.md", "utf8")).toContain(
      "@craigocurtis",
    );
  });

  it("re-exports the patched functions, not the originals", () => {
    expect(fs.existsSync(`${PDF_DIR}/craig-cv.pdf`)).toBe(true);
  });
});
