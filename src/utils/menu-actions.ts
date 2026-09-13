import type { MenuItem } from "../types";

export interface MenuSelectItem {
  label: string;
  value: string;
}

export type MenuAction =
  | { type: "download-pdf"; filename: string }
  | { type: "open-url"; url: string }
  | { type: "navigate"; file: string }
  | { type: "noop" };

export function getMenuItemValue(item: MenuItem): string | undefined {
  return item.file ?? item.theme ?? item.url ?? item.link;
}

function isStaticPdfItem(item: MenuItem): item is MenuItem & { file: string } {
  return !!item.file?.toLowerCase().endsWith(".pdf");
}

/**
 * Drops static-PDF entries (e.g. an HR/ATS CV) whose file isn't packaged, so a
 * human without one never sees a download that can only fail. Themed PDFs are
 * generated for every human and are left alone.
 */
export function filterAvailableMenuItems(
  menu: MenuItem[],
  pdfExists: (filename: string) => boolean,
): MenuItem[] {
  return menu.filter((item) => !isStaticPdfItem(item) || pdfExists(item.file));
}

export function getMenuSelectItems(menu: MenuItem[]): MenuSelectItem[] {
  return menu
    .map((item) => {
      const value = getMenuItemValue(item);
      if (!value) {
        return null;
      }

      return {
        label: item.label,
        value,
      };
    })
    .filter((item): item is MenuSelectItem => item !== null);
}

export function findMenuItemByValue(
  menu: MenuItem[] | undefined,
  value: string,
): MenuItem | undefined {
  if (!menu) {
    return undefined;
  }

  return menu.find((item) => getMenuItemValue(item) === value);
}

export function findMenuItemIndexByValue(
  menu: MenuItem[] | undefined,
  value: string,
): number {
  if (!menu) {
    return -1;
  }

  return menu.findIndex((item) => getMenuItemValue(item) === value);
}

export function resolveMenuAction(
  menuItem: MenuItem | undefined,
  humanName: string,
): MenuAction {
  if (!menuItem) {
    return { type: "noop" };
  }

  if (menuItem.theme) {
    return {
      type: "download-pdf",
      filename: `${humanName.toLowerCase()}-${menuItem.theme}-cv.pdf`,
    };
  }

  if (isStaticPdfItem(menuItem)) {
    return {
      type: "download-pdf",
      filename: menuItem.file,
    };
  }

  if (menuItem.file) {
    return {
      type: "navigate",
      file: menuItem.file,
    };
  }

  const externalUrl = menuItem.url ?? menuItem.link;
  if (externalUrl) {
    return {
      type: "open-url",
      url: externalUrl,
    };
  }

  return { type: "noop" };
}
