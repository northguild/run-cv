import type { HighlightedItem, Page } from "../types";
import {
  canDrillIn,
  computeHighlightedItem,
  computeNavigationHint,
} from "../utils/navigation-utils";

describe("navigation hint logic", () => {
  const somePage: Page = { dir: "foo", file: "foo.md", content: "", menu: [] };

  it("shows only the full arrow-key hint on root level", () => {
    expect(computeNavigationHint([somePage])).toBe(
      "Navigate with arrow keys ↑ ↓ ← →, Press 'q' to quit",
    );
  });

  it("returns empty string on deeper pages (middle level)", () => {
    const pageWithMenu: Page = {
      dir: "bar",
      file: "bar.md",
      content: "",
      menu: [{ label: "x", file: "y" }],
    };
    expect(computeNavigationHint([somePage, pageWithMenu])).toBe("");
  });

  it("returns empty string on deeper pages (bottom level)", () => {
    const bottom: Page = {
      dir: "baz",
      file: "baz.md",
      content: "no menu",
      menu: [],
    };
    expect(computeNavigationHint([somePage, bottom])).toBe("");
  });

  it("highlight helper returns null for page without menu", () => {
    const bottom: Page = {
      dir: "baz",
      file: "baz.md",
      content: "no menu",
      menu: [],
    };
    expect(computeHighlightedItem(bottom, {})).toBeNull();
  });

  it("highlight helper returns appropriate item from navigation memory", () => {
    const pageWithMenu: Page = {
      dir: "bar",
      file: "bar.md",
      content: "",
      menu: [
        { label: "x", file: "y" },
        { label: "z", file: "w" },
      ],
    };
    const result = computeHighlightedItem(pageWithMenu, { bar: 1 });
    expect(result).toEqual({ label: "z", value: "w" });
  });
});

// additional tests for arrow handling guard

describe("drill-in guard", () => {
  const menuItem: HighlightedItem = { label: "foo", value: "foo.md" };

  it("prevents drilling when page is null", () => {
    expect(canDrillIn(null, menuItem)).toBe(false);
  });

  it("prevents drilling when page has no menu", () => {
    const page: Page = { dir: "d", file: "f.md", content: "", menu: [] };
    expect(canDrillIn(page, menuItem)).toBe(false);
  });

  it("prevents drilling when highlightedItem is null", () => {
    const page: Page = {
      dir: "d",
      file: "f.md",
      content: "",
      menu: [{ label: "a", file: "a.md" }],
    };
    expect(canDrillIn(page, null)).toBe(false);
  });

  it("allows drilling when non-empty menu and item present", () => {
    const page: Page = {
      dir: "d",
      file: "f.md",
      content: "",
      menu: [{ label: "a", file: "a.md" }],
    };
    expect(canDrillIn(page, menuItem)).toBe(true);
  });

  it("handles download page items correctly", () => {
    const downloadPage: Page = {
      dir: "download",
      file: "index.md",
      content: "",
      menu: [
        { label: "Modern", theme: "terminal" },
        { label: "Vintage", theme: "vintage" },
      ],
    };
    const highlighted = computeHighlightedItem(downloadPage, {
      download: 1,
    }) as HighlightedItem;
    expect(highlighted).toEqual({ label: "Vintage", value: "vintage" });
    expect(canDrillIn(downloadPage, highlighted)).toBe(true);
  });

  it("handles URL menu items correctly", () => {
    const projectsPage: Page = {
      dir: "projects",
      file: "index.md",
      content: "",
      menu: [
        { label: "Worktree", url: "https://github.com/northguild/worktree" },
      ],
    };
    const highlighted = computeHighlightedItem(projectsPage, {
      projects: 0,
    }) as HighlightedItem;

    expect(highlighted).toEqual({
      label: "Worktree",
      value: "https://github.com/northguild/worktree",
    });
    expect(canDrillIn(projectsPage, highlighted)).toBe(true);
  });
});
