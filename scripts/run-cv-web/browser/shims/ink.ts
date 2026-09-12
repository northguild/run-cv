// run-cv's own import of `ink` resolves here. Same Ink, but the session ends
// cleanly in the page: no console patching, no Ctrl+C process exit, and the
// page is told when the app quits.
import { render as inkRender } from "ink";
import type { RenderOptions } from "ink";
import type { ReactNode } from "react";
import process from "./process.js";

export * from "ink";

export function render(tree: ReactNode, options: RenderOptions = {}) {
  const instance = inkRender(tree, { ...options, patchConsole: false, exitOnCtrlC: false });
  instance.waitUntilExit().then(
    () => process.exit(0),
    () => process.exit(1),
  );
  return instance;
}
