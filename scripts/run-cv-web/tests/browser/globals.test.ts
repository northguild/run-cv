import { describe, expect, it, vi } from "vitest";
import { clearImmediate, setImmediate } from "../../browser/shims/globals.js";

describe("setImmediate", () => {
  it("defers the callback rather than running it inline", async () => {
    const ran = vi.fn();
    setImmediate(ran);
    expect(ran).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 1));
    expect(ran).toHaveBeenCalledOnce();
  });

  it("forwards extra arguments", async () => {
    const ran = vi.fn();
    setImmediate(ran, "a", 1);
    await new Promise((resolve) => setTimeout(resolve, 1));
    expect(ran).toHaveBeenCalledWith("a", 1);
  });

  it("can be cancelled before it fires", async () => {
    const ran = vi.fn();
    clearImmediate(setImmediate(ran));
    await new Promise((resolve) => setTimeout(resolve, 1));
    expect(ran).not.toHaveBeenCalled();
  });
});
