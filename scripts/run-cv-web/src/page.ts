// The page shell is a template so a porting repo can relocate it without
// editing HTML: asset URLs, title, key hints and the terminal colours all come
// from the config.
import type { RunCvWebConfig } from "./config.js";

const TOKEN = /__([A-Z0-9_]+)__/g;

export function pageTokens(config: RunCvWebConfig): Record<string, string> {
  return {
    BASE_PATH: config.basePath,
    TITLE: config.page.title,
    HINT: config.page.hint,
    BACKGROUND: config.terminal.theme.background,
    FOREGROUND: config.terminal.theme.foreground,
    ACCENT: config.terminal.theme.selectionBackground,
    CURSOR: config.terminal.theme.cursor,
    PROMPT_LABEL: config.prompt.label,
    PROMPT_PLACEHOLDER: config.prompt.placeholder,
    PROMPT_NOTE: config.prompt.note,
    // The gate overlay is CSS-hidden in every other state, so the page never
    // flashes a form at someone who is not going to be asked for a name.
    BOOT_STATE: config.prompt.enabled ? "gate" : "running",
  };
}

/**
 * Substitutes every `__TOKEN__`. An unknown token throws rather than shipping
 * a literal `__TOKEN__` to the page, where it would be invisible until someone
 * loaded it.
 */
export function renderPage(template: string, config: RunCvWebConfig): string {
  const tokens = pageTokens(config);
  const unknown = new Set<string>();

  const rendered = template.replace(TOKEN, (match, name: string) => {
    const value = tokens[name];
    if (value === undefined) {
      unknown.add(name);
      return match;
    }
    return value;
  });

  if (unknown.size > 0) {
    throw new Error(
      `run-cv-web: index.html uses unknown token(s): ${[...unknown].sort().join(", ")}. ` +
        `Known tokens: ${Object.keys(tokens).sort().join(", ")}.`,
    );
  }
  return rendered;
}
