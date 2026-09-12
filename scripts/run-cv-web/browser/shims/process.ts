// A `process` for one program in one browser tab: stdout/stderr write to the
// xterm.js terminal, stdin is fed by its keystrokes, and exit ends the session.
import { EventEmitter } from "node:events";

/** The slice of xterm.js this bridge needs. Keeps the shim testable without one. */
export interface TerminalSink {
  write(data: string): void;
}

let terminal: TerminalSink | null = null;
const pending: string[] = [];
const decoder = new TextDecoder();

type WriteCallback = (error?: Error | null) => void;

export class OutputBridge extends EventEmitter {
  isTTY = true;
  columns = 100;
  rows = 30;

  write(
    chunk: string | Uint8Array,
    encoding?: BufferEncoding | WriteCallback,
    callback?: WriteCallback,
  ): boolean {
    const done = typeof encoding === "function" ? encoding : callback;
    const text = typeof chunk === "string" ? chunk : decoder.decode(chunk);
    if (terminal) terminal.write(text);
    else pending.push(text);
    done?.();
    return true;
  }

  getColorDepth(): number {
    return 24;
  }

  hasColors(): boolean {
    return true;
  }

  end(): void {}
  cork(): void {}
  uncork(): void {}
}

/** Ink reads stdin by listening for `readable` and draining `read()`. */
export class InputBridge extends EventEmitter {
  isTTY = true;
  isRaw = false;
  #queue: string[] = [];

  setRawMode(mode: boolean): this {
    this.isRaw = mode;
    return this;
  }

  setEncoding(): this {
    return this;
  }

  ref(): this {
    return this;
  }

  unref(): this {
    return this;
  }

  resume(): this {
    return this;
  }

  pause(): this {
    return this;
  }

  read(): string | null {
    return this.#queue.length > 0 ? (this.#queue.shift() as string) : null;
  }

  push(data: string): void {
    this.#queue.push(data);
    this.emit("readable");
  }
}

export const stdout = new OutputBridge();
export const stderr = new OutputBridge();
export const stdin = new InputBridge();

export function attachTerminal(next: TerminalSink): void {
  terminal = next;
  for (const text of pending.splice(0)) terminal.write(text);
}

export function resize(columns: number, rows: number): void {
  for (const stream of [stdout, stderr]) {
    stream.columns = columns;
    stream.rows = rows;
    stream.emit("resize");
  }
}

/** Test seam: forget the attached terminal and any buffered output. */
export function resetForTests(): void {
  terminal = null;
  pending.length = 0;
  exitHandler = () => {};
  exited = false;
  process.exitCode = undefined;
}

type ExitHandler = (code: number) => void;

let exitHandler: ExitHandler = () => {};
let exited = false;

export function onExit(handler: ExitHandler): void {
  exitHandler = handler;
}

const events = new EventEmitter();
const start = performance.now();

type HrTime = [number, number];

function hrtime(previous?: HrTime): HrTime {
  const elapsed = performance.now() - start;
  let seconds = Math.floor(elapsed / 1000);
  let nanoseconds = Math.floor((elapsed % 1000) * 1e6);
  if (previous) {
    seconds -= previous[0];
    nanoseconds -= previous[1];
    if (nanoseconds < 0) {
      seconds -= 1;
      nanoseconds += 1e9;
    }
  }
  return [seconds, nanoseconds];
}
hrtime.bigint = (): bigint => BigInt(Math.floor((performance.now() - start) * 1e6));

export const process = {
  env: {
    TERM: "xterm-256color",
    COLORTERM: "truecolor",
    FORCE_COLOR: "3",
    NODE_ENV: "production",
  } as Record<string, string>,
  argv: ["node", "run-cv"],
  argv0: "node",
  execArgv: [] as string[],
  execPath: "/usr/local/bin/node",
  platform: "linux",
  arch: "x64",
  pid: 1,
  ppid: 0,
  title: "run-cv",
  version: "v22.0.0",
  versions: { node: "22.0.0" },
  release: { name: "node" },
  exitCode: undefined as number | undefined,
  stdout,
  stderr,
  stdin,
  cwd: () => "/",
  chdir() {},
  umask: () => 0o022,
  hrtime,
  uptime: () => (performance.now() - start) / 1000,
  memoryUsage: () => ({ rss: 0, heapTotal: 0, heapUsed: 0, external: 0, arrayBuffers: 0 }),
  nextTick: (callback: (...args: unknown[]) => void, ...args: unknown[]) =>
    queueMicrotask(() => callback(...args)),
  emitWarning() {},
  kill() {},
  exit(code = 0) {
    if (exited) return;
    exited = true;
    process.exitCode = code;
    exitHandler(code);
  },
  // Node's EventEmitter methods return `this` for chaining; these forward to
  // the real emitter and hand the chain back to the shim, not the emitter.
  on: (...args: Parameters<EventEmitter["on"]>) => {
    events.on(...args);
    return process;
  },
  once: (...args: Parameters<EventEmitter["once"]>) => {
    events.once(...args);
    return process;
  },
  off: (...args: Parameters<EventEmitter["off"]>) => {
    events.off(...args);
    return process;
  },
  addListener: (...args: Parameters<EventEmitter["addListener"]>) => {
    events.addListener(...args);
    return process;
  },
  removeListener: (...args: Parameters<EventEmitter["removeListener"]>) => {
    events.removeListener(...args);
    return process;
  },
  removeAllListeners: (...args: Parameters<EventEmitter["removeAllListeners"]>) => {
    events.removeAllListeners(...args);
    return process;
  },
  prependListener: (...args: Parameters<EventEmitter["prependListener"]>) => {
    events.prependListener(...args);
    return process;
  },
  emit: (...args: Parameters<EventEmitter["emit"]>) => events.emit(...args),
  listeners: (name: string) => events.listeners(name),
  listenerCount: (name: string) => events.listenerCount(name),
};

export default process;

// Named imports like `import { cwd } from "node:process"` (Ink uses several).
export const {
  env,
  argv,
  platform,
  arch,
  cwd,
  exit,
  nextTick,
  uptime,
  versions,
  version,
  emitWarning,
} = process;
export { hrtime };
