import type { Token as MarkedToken, Tokens } from "marked";

export interface MenuItem {
  label: string;
  file?: string;
  theme?: string;
  url?: string;
  link?: string;
}

export interface Page {
  content: string;
  menu: MenuItem[];
  dir: string;
  file?: string;
}

export interface HighlightedItem {
  label: string;
  value: string;
}

export interface HumanManifest extends Page {
  name: string;
  role: string;
  skills?: string[]; // parsed from frontmatter comma-separated list
  portfolio?: string;
}

export interface JSONEntry {
  section: string;
  frontmatter: Record<string, unknown>;
  content: string;
}

export interface JSONOutput {
  name: string;
  entries: JSONEntry[];
}

// Simplified approach - just add an ID to any token
export type TokenWithId = MarkedToken & {
  id: string;
};

export type ListItemWithId = Tokens.ListItem & {
  id: string;
  tokens: TokenWithId[];
};
