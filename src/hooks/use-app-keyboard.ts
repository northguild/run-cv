import { useInput } from "ink";
import type { HighlightedItem } from "../types";

interface ContactInfo {
  email?: string;
  linkedin?: string;
  portfolio?: string;
}

interface UseAppKeyboardOptions {
  canGoBack: boolean;
  hasError: boolean;
  isContactPage: boolean;
  highlightedItem: HighlightedItem | null;
  canUsePrimaryAction: boolean;
  contactInfo: ContactInfo;
  onBack: () => void;
  onQuit: () => void;
  onPrimaryAction: (item: HighlightedItem) => void;
  onContactEmail: () => void;
  onContactLinkedIn: () => void;
  onContactPortfolio: () => void;
}

export function useAppKeyboard({
  canGoBack,
  hasError,
  isContactPage,
  highlightedItem,
  canUsePrimaryAction,
  contactInfo,
  onBack,
  onQuit,
  onPrimaryAction,
  onContactEmail,
  onContactLinkedIn,
  onContactPortfolio,
}: UseAppKeyboardOptions): void {
  useInput((input, key) => {
    if (key.escape || key.leftArrow || (input === "b" && canGoBack)) {
      if (canGoBack) {
        onBack();
      }
      return;
    }

    if (input === "q" && (!canGoBack || hasError)) {
      onQuit();
      return;
    }

    if (isContactPage) {
      if (input === "m" && contactInfo.email) {
        onContactEmail();
      }
      if (input === "l" && contactInfo.linkedin) {
        onContactLinkedIn();
      }
      if (input === "p" && contactInfo.portfolio) {
        onContactPortfolio();
      }
      return;
    }

    if (
      (key.rightArrow || input === " ") &&
      canUsePrimaryAction &&
      highlightedItem
    ) {
      onPrimaryAction(highlightedItem);
    }
  });
}
