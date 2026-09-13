import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { vi } from "vitest";

import type { Page } from "../types";
import { executeMenuAction } from "../utils/menu-action-executor";
import type { MenuAction } from "../utils/menu-actions";

vi.mock("open", () => {
  return {
    default: vi.fn(async () => {}),
  };
});

interface RunExecutorOptions {
  currentDir?: string;
  pdfRoot?: string;
  loadPage?: (baseDir: string, file: string) => Promise<Page>;
}

async function runExecutor(action: MenuAction, options?: RunExecutorOptions) {
  const errors: string[] = [];
  const navigations: Page[] = [];

  await executeMenuAction({
    action,
    currentDir: options?.currentDir ?? "/tmp/current",
    pdfRoot: options?.pdfRoot ?? "/tmp/pdf",
    loadPage: async (baseDir: string, file: string) => {
      if (options?.loadPage) {
        return options.loadPage(baseDir, file);
      }

      return { dir: baseDir, file, content: "", menu: [] };
    },
    onNavigate: (nextPage) => {
      navigations.push(nextPage);
    },
    onError: (message) => {
      errors.push(message);
    },
  });

  return { errors, navigations };
}

describe("menu action executor", () => {
  it("opens URL actions in default browser", async () => {
    const { default: open } = await import("open");
    const openSpy = vi.mocked(open);

    await runExecutor({
      type: "open-url",
      url: "https://github.com/northguild/worktree",
    });

    expect(openSpy).toHaveBeenCalledWith(
      "https://github.com/northguild/worktree",
    );
  });

  it("navigates for markdown actions", async () => {
    const { errors, navigations } = await runExecutor(
      { type: "navigate", file: "projects/index.md" },
      {
        currentDir: "/tmp/human",
      },
    );

    expect(errors).toEqual([]);
    expect(navigations).toHaveLength(1);
    expect(navigations[0]).toEqual({
      dir: "/tmp/human",
      file: "projects/index.md",
      content: "",
      menu: [],
    });
  });

  it("downloads static PDF actions", async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "menu-exec-"));
    const pdfRoot = path.join(tempRoot, "dist", "pdf");
    fs.mkdirSync(pdfRoot, { recursive: true });
    fs.writeFileSync(path.join(pdfRoot, "baldur-cv.pdf"), "PDF");

    const copySpy = vi.spyOn(fs, "copyFileSync").mockImplementation(() => {});

    const { errors } = await runExecutor(
      {
        type: "download-pdf",
        filename: "baldur-cv.pdf",
      },
      { pdfRoot },
    );

    expect(errors).toEqual([]);
    expect(copySpy).toHaveBeenCalledTimes(1);

    copySpy.mockRestore();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("reports a PDF that is not packaged instead of copying", async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "menu-exec-"));
    const copySpy = vi.spyOn(fs, "copyFileSync").mockImplementation(() => {});

    const { errors } = await runExecutor(
      { type: "download-pdf", filename: "nobody-cv.pdf" },
      { pdfRoot: tempRoot },
    );

    expect(errors).toEqual([
      "ARCHIVE ERROR: Resource nobody-cv.pdf not found in package.",
    ]);
    expect(copySpy).not.toHaveBeenCalled();

    copySpy.mockRestore();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });
});
