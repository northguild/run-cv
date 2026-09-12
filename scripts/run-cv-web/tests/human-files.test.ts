import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { collectHumanFiles } from "../src/human-files.js";
import { rm } from "node:fs/promises";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "run-cv-humans-"));
  await mkdir(path.join(dir, "craig/career"), { recursive: true });
  await mkdir(path.join(dir, "craig/organizations/deep"), { recursive: true });
  await writeFile(path.join(dir, "craig/introduction.md"), "# INTRO");
  await writeFile(path.join(dir, "craig/career/index.md"), "# CAREER");
  await writeFile(path.join(dir, "craig/organizations/deep/x.md"), "# DEEP");
  await mkdir(path.join(dir, "baldur"), { recursive: true });
  await writeFile(path.join(dir, "baldur/introduction.md"), "# BALDUR");
});

afterEach(async () => rm(dir, { recursive: true, force: true }));

describe("collectHumanFiles", () => {
  it("keys each file by the path run-cv believes it was installed to", async () => {
    const files = await collectHumanFiles(dir, ["craig"], "/run-cv/dist");
    expect(files["/run-cv/dist/humans/craig/introduction.md"]).toBe("# INTRO");
  });

  it("walks nested directories to any depth", async () => {
    const files = await collectHumanFiles(dir, ["craig"], "/run-cv/dist");
    expect(files["/run-cv/dist/humans/craig/career/index.md"]).toBe("# CAREER");
    expect(files["/run-cv/dist/humans/craig/organizations/deep/x.md"]).toBe("# DEEP");
  });

  it("collects only the humans asked for", async () => {
    const files = await collectHumanFiles(dir, ["craig"], "/run-cv/dist");
    expect(Object.keys(files)).toHaveLength(3);
    expect(Object.keys(files).some((k) => k.includes("baldur"))).toBe(false);
  });

  // The run-cv repo's own page offers both humans.
  it("merges several humans without collision", async () => {
    const files = await collectHumanFiles(dir, ["craig", "baldur"], "/run-cv/dist");
    expect(Object.keys(files)).toHaveLength(4);
    expect(files["/run-cv/dist/humans/baldur/introduction.md"]).toBe("# BALDUR");
    expect(files["/run-cv/dist/humans/craig/introduction.md"]).toBe("# INTRO");
  });

  it("honours a different virtual dist", async () => {
    const files = await collectHumanFiles(dir, ["craig"], "/elsewhere");
    expect(Object.keys(files).every((k) => k.startsWith("/elsewhere/humans/craig/"))).toBe(true);
  });

  // The keys become paths inside memfs, which is POSIX whatever the host is.
  it("always produces POSIX keys", async () => {
    const files = await collectHumanFiles(dir, ["craig"], "/run-cv/dist");
    expect(Object.keys(files).every((k) => !k.includes("\\"))).toBe(true);
  });

  it("fails loudly when a human's directory is missing", async () => {
    await expect(collectHumanFiles(dir, ["nobody"], "/run-cv/dist")).rejects.toThrow();
  });
});
