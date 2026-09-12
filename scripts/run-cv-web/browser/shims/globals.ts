// Injected into every bundled module so bare Node globals resolve.

export { Buffer } from "buffer/";
export { process } from "./process.js";

// Ink schedules its final unmount with setImmediate, which browsers lack.
export const setImmediate = (callback: (...args: unknown[]) => void, ...args: unknown[]): number =>
  setTimeout(callback, 0, ...args) as unknown as number;
export const clearImmediate = (handle: number): void => clearTimeout(handle);
