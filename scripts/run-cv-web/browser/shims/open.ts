// run-cv opens URLs, mailto links and downloaded PDFs with `open`. In the
// browser only https: and mailto: may leave the page, and always without an
// opener. A PDF goes to the site's own CV.
import config from "virtual:run-cv-web-config";
import { pdfUrlFor } from "./session.js";

export type OpenTarget =
  | { kind: "pdf"; url: string }
  | { kind: "external"; url: string }
  | { kind: "blocked"; url: string };

/**
 * Decides what may leave the page. Separated from the opening so the policy is
 * assertable without a DOM — this is the shim's whole security surface.
 *
 * run-cv copies a PDF to `~/Downloads` and opens *the copy*, so what arrives
 * here is `<homedir>/Downloads/craig-vintage-cv.pdf`, not the packaged path.
 * Only the basename is meaningful; `resolvePdf` turns it into a URL.
 */
export function classifyTarget(
  target: unknown,
  resolvePdf: (file: string) => string = defaultResolvePdf,
): OpenTarget {
  const value = String(target);
  if (value.toLowerCase().endsWith(".pdf")) {
    return { kind: "pdf", url: resolvePdf(value.split("/").pop() ?? "") };
  }
  if (/^(https:|mailto:)/i.test(value)) return { kind: "external", url: value };
  return { kind: "blocked", url: value };
}

/** Per-human under the gate; a single site-wide CV otherwise. */
function defaultResolvePdf(file: string): string {
  return config.prompt.enabled ? pdfUrlFor(file) : config.cvUrl;
}

export default async function open(target: unknown): Promise<void> {
  const result = classifyTarget(target);
  if (result.kind === "blocked") {
    throw new Error("Only https and mailto links can be opened from the browser.");
  }
  window.open(result.url, "_blank", "noopener,noreferrer");
}
