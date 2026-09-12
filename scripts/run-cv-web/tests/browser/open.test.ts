import { afterEach, describe, expect, it, vi } from "vitest";
import open, { classifyTarget } from "../../browser/shims/open.js";

const CV = "/craig-curtis-cv.pdf";

afterEach(() => vi.restoreAllMocks());

describe("classifyTarget", () => {
  it("sends any PDF to the site's own CV rather than the packaged one", () => {
    expect(classifyTarget("/run-cv/dist/pdf/craig-cv.pdf")).toEqual({ kind: "pdf", url: CV });
    expect(classifyTarget("/home/visitor/Downloads/CRAIG-CV.PDF")).toEqual({
      kind: "pdf",
      url: CV,
    });
  });

  it("lets https and mailto out", () => {
    expect(classifyTarget("https://example.com")).toEqual({
      kind: "external",
      url: "https://example.com",
    });
    expect(classifyTarget("mailto:someone@example.com")).toEqual({
      kind: "external",
      url: "mailto:someone@example.com",
    });
    expect(classifyTarget("HTTPS://EXAMPLE.COM").kind).toBe("external");
  });

  // The whole point of the shim: a bundled CLI must not be able to navigate
  // the visitor anywhere it likes.
  it("blocks every other scheme", () => {
    for (const target of [
      "http://example.com",
      "file:///etc/passwd",
      "javascript:alert(1)",
      "data:text/html,<script>",
      "/some/local/path",
      "",
    ]) {
      expect(classifyTarget(target).kind, target).toBe("blocked");
    }
  });

  it("resolves a PDF through the injected resolver, by basename", () => {
    const resolve = (file: string) => `/h/abc/pdf/${file}`;
    expect(classifyTarget("x.pdf", resolve)).toEqual({ kind: "pdf", url: "/h/abc/pdf/x.pdf" });
  });

  it("strips the Downloads path run-cv actually opens, keeping only the basename", () => {
    const resolve = (file: string) => `/h/abc/pdf/${file}`;
    expect(classifyTarget("/home/visitor/Downloads/craig-vintage-cv.pdf", resolve)).toEqual({
      kind: "pdf",
      url: "/h/abc/pdf/craig-vintage-cv.pdf",
    });
  });
});

describe("open", () => {
  it("opens allowed targets in a new tab with no opener", async () => {
    const windowOpen = vi.spyOn(window, "open").mockReturnValue(null);
    await open("https://example.com");
    expect(windowOpen).toHaveBeenCalledWith("https://example.com", "_blank", "noopener,noreferrer");
  });

  it("redirects PDFs to the configured CV", async () => {
    const windowOpen = vi.spyOn(window, "open").mockReturnValue(null);
    await open("/run-cv/dist/pdf/craig-cv.pdf");
    expect(windowOpen).toHaveBeenCalledWith(CV, "_blank", "noopener,noreferrer");
  });

  it("throws and opens nothing for a blocked target", async () => {
    const windowOpen = vi.spyOn(window, "open").mockReturnValue(null);
    await expect(open("javascript:alert(1)")).rejects.toThrow(/Only https and mailto/);
    expect(windowOpen).not.toHaveBeenCalled();
  });
});
