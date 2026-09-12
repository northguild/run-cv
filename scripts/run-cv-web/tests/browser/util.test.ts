import { describe, expect, it } from "vitest";
import { isDeepStrictEqual } from "../../browser/shims/util.js";

describe("isDeepStrictEqual", () => {
  it("compares primitives by Object.is semantics", () => {
    expect(isDeepStrictEqual(1, 1)).toBe(true);
    expect(isDeepStrictEqual("a", "a")).toBe(true);
    expect(isDeepStrictEqual(NaN, NaN)).toBe(true);
    expect(isDeepStrictEqual(0, -0)).toBe(false);
    expect(isDeepStrictEqual(1, "1")).toBe(false);
  });

  it("treats null as a value, not an object to walk", () => {
    expect(isDeepStrictEqual(null, null)).toBe(true);
    expect(isDeepStrictEqual(null, {})).toBe(false);
    expect(isDeepStrictEqual({}, null)).toBe(false);
    expect(isDeepStrictEqual(null, undefined)).toBe(false);
  });

  it("walks nested objects", () => {
    expect(isDeepStrictEqual({ a: { b: [1, 2] } }, { a: { b: [1, 2] } })).toBe(true);
    expect(isDeepStrictEqual({ a: { b: [1, 2] } }, { a: { b: [1, 3] } })).toBe(false);
  });

  it("does not conflate arrays with objects", () => {
    expect(isDeepStrictEqual([], {})).toBe(false);
    expect(isDeepStrictEqual([1], { 0: 1 })).toBe(false);
  });

  it("rejects objects that differ only in key count", () => {
    expect(isDeepStrictEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(isDeepStrictEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false);
  });

  // The count-only check this replaced returned true here: equal key counts,
  // and a missing key reads back as undefined on both sides.
  it("rejects objects with the same shape but different key names", () => {
    expect(isDeepStrictEqual({ a: undefined }, { b: undefined })).toBe(false);
    expect(isDeepStrictEqual({ a: 1, b: 2 }, { a: 1, c: 2 })).toBe(false);
  });

  it("compares arrays element-wise, including length", () => {
    expect(isDeepStrictEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(isDeepStrictEqual([1, 2], [1, 2, 3])).toBe(false);
  });
});
