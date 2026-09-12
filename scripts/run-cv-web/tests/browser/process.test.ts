import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  InputBridge,
  OutputBridge,
  attachTerminal,
  onExit,
  process,
  resetForTests,
  resize,
  stdin,
  stdout,
} from "../../browser/shims/process.js";

const sink = () => {
  const written: string[] = [];
  return { written, write: (data: string) => void written.push(data) };
};

beforeEach(() => resetForTests());

describe("OutputBridge", () => {
  it("buffers writes made before a terminal exists, then flushes them in order", () => {
    stdout.write("first ");
    stdout.write("second");
    const terminal = sink();
    attachTerminal(terminal);
    expect(terminal.written.join("")).toBe("first second");
  });

  it("writes straight through once attached", () => {
    const terminal = sink();
    attachTerminal(terminal);
    stdout.write("live");
    expect(terminal.written).toEqual(["live"]);
  });

  it("decodes byte chunks", () => {
    const terminal = sink();
    attachTerminal(terminal);
    stdout.write(new TextEncoder().encode("bytes"));
    expect(terminal.written).toEqual(["bytes"]);
  });

  it("invokes the callback in both Node signatures", () => {
    attachTerminal(sink());
    const withEncoding = vi.fn();
    const withoutEncoding = vi.fn();
    stdout.write("a", "utf8", withEncoding);
    stdout.write("b", withoutEncoding);
    expect(withEncoding).toHaveBeenCalledOnce();
    expect(withoutEncoding).toHaveBeenCalledOnce();
  });

  it("reports truecolor, which is what makes chalk emit 24-bit escapes", () => {
    const bridge = new OutputBridge();
    expect(bridge.getColorDepth()).toBe(24);
    expect(bridge.hasColors()).toBe(true);
    expect(bridge.isTTY).toBe(true);
  });
});

describe("InputBridge", () => {
  it("emits readable on push and drains FIFO", () => {
    const bridge = new InputBridge();
    const readable = vi.fn();
    bridge.on("readable", readable);

    bridge.push("a");
    bridge.push("b");

    expect(readable).toHaveBeenCalledTimes(2);
    expect(bridge.read()).toBe("a");
    expect(bridge.read()).toBe("b");
    expect(bridge.read()).toBeNull();
  });

  it("returns itself from the stream methods Ink chains", () => {
    const bridge = new InputBridge();
    expect(bridge.setRawMode(true)).toBe(bridge);
    expect(bridge.isRaw).toBe(true);
    expect(bridge.setEncoding()).toBe(bridge);
    expect(bridge.ref()).toBe(bridge);
    expect(bridge.unref()).toBe(bridge);
    expect(bridge.resume()).toBe(bridge);
    expect(bridge.pause()).toBe(bridge);
  });

  it("shares one stdin instance with the terminal wiring", () => {
    expect(stdin).toBeInstanceOf(InputBridge);
  });
});

describe("resize", () => {
  it("updates both output streams and announces it", () => {
    const resized = vi.fn();
    stdout.on("resize", resized);
    resize(120, 40);
    expect(stdout.columns).toBe(120);
    expect(stdout.rows).toBe(40);
    expect(resized).toHaveBeenCalledOnce();
    stdout.off("resize", resized);
  });
});

describe("process.exit", () => {
  it("records the code and notifies the page once", () => {
    const handler = vi.fn();
    onExit(handler);
    process.exit(0);
    expect(handler).toHaveBeenCalledExactlyOnceWith(0);
    expect(process.exitCode).toBe(0);
  });

  // Ink can unmount and then the CLI can call exit itself; a second run would
  // reset the page state after it had already been shown as ended.
  it("is idempotent", () => {
    const handler = vi.fn();
    onExit(handler);
    process.exit(2);
    process.exit(9);
    expect(handler).toHaveBeenCalledExactlyOnceWith(2);
    expect(process.exitCode).toBe(2);
  });
});

describe("process.hrtime", () => {
  it("returns [seconds, nanoseconds] within range", () => {
    const [seconds, nanoseconds] = process.hrtime();
    expect(seconds).toBeGreaterThanOrEqual(0);
    expect(nanoseconds).toBeGreaterThanOrEqual(0);
    expect(nanoseconds).toBeLessThan(1e9);
  });

  it("borrows correctly when the nanosecond part goes negative", () => {
    const [seconds, nanoseconds] = process.hrtime([0, 999_999_999]);
    expect(nanoseconds).toBeGreaterThanOrEqual(0);
    expect(nanoseconds).toBeLessThan(1e9);
    expect(seconds).toBeLessThanOrEqual(0);
  });

  it("exposes a bigint form", () => {
    expect(typeof process.hrtime.bigint()).toBe("bigint");
  });
});

describe("process identity", () => {
  it("presents as a colour-capable Linux TTY, which is what run-cv branches on", () => {
    expect(process.env.TERM).toBe("xterm-256color");
    expect(process.env.COLORTERM).toBe("truecolor");
    expect(process.platform).toBe("linux");
    expect(process.stdout.isTTY).toBe(true);
  });

  it("returns itself from the EventEmitter methods so calls can chain", () => {
    const noop = () => {};
    expect(process.on("x", noop)).toBe(process);
    expect(process.off("x", noop)).toBe(process);
  });
});
