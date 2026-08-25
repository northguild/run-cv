import type { MenuItem } from "../types";
import {
  findMenuItemByValue,
  findMenuItemIndexByValue,
  getMenuItemValue,
  getMenuSelectItems,
  resolveMenuAction,
} from "../utils/menu-actions";

describe("menu actions", () => {
  it("resolves a theme menu item to generated PDF action", () => {
    const action = resolveMenuAction(
      { label: "Terminal", theme: "terminal" },
      "Craig",
    );

    expect(action).toEqual({
      type: "download-pdf",
      filename: "craig-terminal-cv.pdf",
    });
  });

  it("resolves a static PDF file menu item to download action", () => {
    const action = resolveMenuAction(
      { label: "ATS", file: "craig-cv.pdf" },
      "Craig",
    );

    expect(action).toEqual({
      type: "download-pdf",
      filename: "craig-cv.pdf",
    });
  });

  it("resolves URL menu item to open-url action", () => {
    const action = resolveMenuAction(
      { label: "Worktree", url: "https://github.com/northguild/worktree" },
      "Craig",
    );

    expect(action).toEqual({
      type: "open-url",
      url: "https://github.com/northguild/worktree",
    });
  });

  it("supports legacy link frontmatter field for compatibility", () => {
    const action = resolveMenuAction(
      { label: "Legacy", link: "https://example.com" },
      "Craig",
    );

    expect(action).toEqual({
      type: "open-url",
      url: "https://example.com",
    });
  });

  it("resolves markdown file menu item to navigate action", () => {
    const action = resolveMenuAction(
      { label: "Career", file: "career/index.md" },
      "Craig",
    );

    expect(action).toEqual({
      type: "navigate",
      file: "career/index.md",
    });
  });

  it("maps menu values and lookup helpers for mixed menu actions", () => {
    const menu: MenuItem[] = [
      { label: "Career", file: "career/index.md" },
      { label: "Terminal", theme: "terminal" },
      { label: "Worktree", url: "https://github.com/northguild/worktree" },
    ];

    expect(getMenuItemValue(menu[0])).toBe("career/index.md");
    expect(getMenuItemValue(menu[1])).toBe("terminal");
    expect(getMenuItemValue(menu[2])).toBe(
      "https://github.com/northguild/worktree",
    );

    expect(getMenuSelectItems(menu)).toEqual([
      { label: "Career", value: "career/index.md" },
      { label: "Terminal", value: "terminal" },
      {
        label: "Worktree",
        value: "https://github.com/northguild/worktree",
      },
    ]);

    expect(findMenuItemByValue(menu, "terminal")?.label).toBe("Terminal");
    expect(
      findMenuItemIndexByValue(menu, "https://github.com/northguild/worktree"),
    ).toBe(2);
  });
});
