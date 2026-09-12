// The `util` polyfill plus the one newer helper a bundled dependency imports.
import util from "util/";

/**
 * Structural equality for plain data — enough for the option comparisons it's
 * used for.
 *
 * Key *names* are compared, not just how many there are: `{ a: undefined }` and
 * `{ b: undefined }` have equal key counts, and looking up a missing key on
 * either side yields `undefined`, so a count-only check would call them equal.
 */
export function isDeepStrictEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);
  if (keysA.length !== keysB.length) return false;

  const recordA = a as Record<string, unknown>;
  const recordB = b as Record<string, unknown>;
  return keysA.every(
    (key) => Object.hasOwn(recordB, key) && isDeepStrictEqual(recordA[key], recordB[key]),
  );
}

export const { inspect, format, inherits, promisify, deprecate, types, TextEncoder, TextDecoder } =
  util;
export default { ...util, isDeepStrictEqual };
