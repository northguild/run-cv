import { vi } from "vitest";

/**
 * Stands in for `ink` under test. The real one belongs to run-cv and pnpm keeps
 * it private to that package; the bundler resolves it from run-cv's own install
 * directory, which Vite cannot do. A static `export *` has to resolve at
 * transform time, so an alias is needed rather than `vi.mock`.
 */
export const render = vi.fn();

/** A passthrough export, to prove the wrapper's `export *` still works. */
export const Text = "Text";
