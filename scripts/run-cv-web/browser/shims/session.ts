// The one piece of runtime state the shims share.
//
// Under the gate the human is not known at build time — it is whatever the
// visitor typed — so the `meow` stub and the `open` shim read it from here
// instead of from a baked-in constant.
let human = "";
let pdfBase = "";

export function setSession(name: string, base: string): void {
  human = name;
  pdfBase = base;
}

export function currentHuman(): string {
  return human;
}

/** Resolves a PDF basename to its URL under the human's payload directory. */
export function pdfUrlFor(file: string): string {
  return pdfBase + file;
}
