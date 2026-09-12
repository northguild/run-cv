import { describe, expect, it } from "vitest";
import { hashHuman } from "../shared/human-hash.js";

const SALT = "test-salt";

describe("hashHuman", () => {
  // A golden vector. The build writes payloads to these directory names and the
  // page derives them again in a different runtime; if the two ever disagreed,
  // every name would 404 and the terminal would simply stay locked.
  it("is a stable SHA-256 of salt and name", async () => {
    expect(await hashHuman("craig", SALT)).toBe(
      "a29ed496d58acdd1b0a0d556e91ca3052aa04097dab4347f4e3ba87c8d2c97ac",
    );
  });

  it("produces a 64-character lowercase hex digest", async () => {
    expect(await hashHuman("anyone", SALT)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("normalises case and surrounding whitespace, as a typed name will vary", async () => {
    const expected = await hashHuman("craig", SALT);
    for (const typed of ["Craig", "  craig", "CRAIG  ", " CrAiG "]) {
      expect(await hashHuman(typed, SALT), typed).toBe(expected);
    }
  });

  it("does not normalise inner whitespace — that is a different name", async () => {
    expect(await hashHuman("cr aig", SALT)).not.toBe(await hashHuman("craig", SALT));
  });

  it("separates the salt from the name, so no two configs collide", async () => {
    // Without the delimiter, salt "ab" + name "c" and salt "a" + name "bc"
    // would hash identically.
    expect(await hashHuman("c", "ab")).not.toBe(await hashHuman("bc", "a"));
  });

  it("gives every human a different directory", async () => {
    expect(await hashHuman("craig", SALT)).not.toBe(await hashHuman("baldur", SALT));
  });

  it("changes every directory when the salt changes", async () => {
    expect(await hashHuman("craig", SALT)).not.toBe(await hashHuman("craig", "other"));
  });
});
