import { describe, expect, it, vi } from "vitest";

import { render as inkRender } from "ink";
import { Text, render } from "../../browser/shims/ink.js";
import { process, resetForTests } from "../../browser/shims/process.js";

const waitUntilExit = vi.fn();

const setup = (exit: Promise<void>) => {
  resetForTests();
  vi.mocked(inkRender).mockReset();
  waitUntilExit.mockReset().mockReturnValue(exit);
  vi.mocked(inkRender).mockReturnValue({ waitUntilExit } as never);
};

it("re-exports the rest of Ink untouched", () => {
  expect(Text).toBe("Text");
});

describe("the ink wrapper", () => {
  it("disables console patching and Ctrl+C exit", () => {
    setup(new Promise(() => {}));
    render(null);
    expect(inkRender).toHaveBeenCalledWith(null, { patchConsole: false, exitOnCtrlC: false });
  });

  it("keeps the caller's other options", () => {
    setup(new Promise(() => {}));
    render(null, { debug: true } as never);
    expect(inkRender).toHaveBeenCalledWith(null, {
      debug: true,
      patchConsole: false,
      exitOnCtrlC: false,
    });
  });

  // The caller's own patchConsole: true would defeat the shim, so the wrapper
  // must win — it is spread last for exactly this reason.
  it("overrides a caller that asks for console patching", () => {
    setup(new Promise(() => {}));
    render(null, { patchConsole: true, exitOnCtrlC: true } as never);
    expect(inkRender).toHaveBeenCalledWith(null, { patchConsole: false, exitOnCtrlC: false });
  });

  it("ends the session with 0 when the app unmounts cleanly", async () => {
    setup(Promise.resolve());
    render(null);
    await vi.waitFor(() => expect(process.exitCode).toBe(0));
  });

  it("ends the session with 1 when the app throws", async () => {
    setup(Promise.reject(new Error("boom")));
    render(null);
    await vi.waitFor(() => expect(process.exitCode).toBe(1));
  });

  it("returns the Ink instance to the caller", () => {
    setup(new Promise(() => {}));
    expect(render(null)).toEqual({ waitUntilExit });
  });
});
