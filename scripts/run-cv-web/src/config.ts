// The single configuration surface for the run-cv browser build.
//
// Everything a porting repo needs to change lives in `run-cv-web.config.ts` at
// the root of this folder. Nothing else should hardcode a path, a colour or a
// human's name — if you find yourself adding a constant to a shim, add it here
// instead, and it will reach the browser through `virtual:run-cv-web-config`.

import path from "node:path";

/** xterm's colour slots. Kept to the four run-cv actually needs. */
export interface TerminalTheme {
  background: string;
  foreground: string;
  cursor: string;
  selectionBackground: string;
}

export interface TerminalConfig {
  /** run-cv draws a fixed 80-column frame; fewer columns and it breaks. */
  needColumns: number;
  /**
   * run-cv's tallest screen. Ink clears and redraws everything on every frame
   * once output is at least as tall as the terminal, leaving the top
   * unreachable, so one spare row is exactly enough.
   */
  needRows: number;
  maxFont: number;
  minFont: number;
  theme: TerminalTheme;
}

export interface PageConfig {
  title: string;
  /** The key hints in the footer bar. */
  hint: string;
}

/**
 * The name prompt. When enabled the bundle ships with no CV content at all:
 * each human's markdown is written to `<payloadDir>/<hash>/payload.json` and
 * fetched only once a visitor types a name that hashes to it.
 */
export interface PromptConfig {
  enabled: boolean;
  /** The fixed text before the input, e.g. `npx run-cv`. */
  label: string;
  placeholder: string;
  /** A line under the prompt. Keep it free of names. */
  note: string;
}

/** Where the run-cv program itself comes from. */
export type SourceConfig =
  /** Bundle the published npm package, as the portfolio does. */
  | { mode: "package"; packageName: string }
  /** Bundle a checkout's own source, so the page tracks HEAD. */
  | { mode: "src"; entry: string };

/**
 * The subset that is serialised into the bundle for the browser half.
 *
 * Note `humans` is optional, and is omitted entirely when the prompt is on.
 * Interpolating the allowlist here would put both names straight back into
 * `terminal.js` and undo the whole exercise.
 */
export interface BrowserConfig {
  cvUrl: string;
  homedir: string;
  virtualDist: string;
  humans?: readonly string[];
  terminal: TerminalConfig;
  prompt: PromptConfig;
  /** URL prefix the per-human payload directories are served from. */
  payloadBase: string;
  hashSalt: string;
}

export interface RunCvWebConfig {
  source: SourceConfig;
  /** Humans whose markdown is bundled. More than one enables selection. */
  humans: readonly string[];
  /** Build output directory, relative to the repo root. */
  outDir: string;
  /** URL prefix the page's own assets are served from. Needs a trailing slash. */
  basePath: string;
  /** Where run-cv believes it lives inside the in-memory filesystem. */
  virtualDist: string;
  /** Where a "download my CV" action sends the visitor. Unused under the prompt. */
  cvUrl: string;
  homedir: string;
  terminal: TerminalConfig;
  page: PageConfig;
  prompt: PromptConfig;
  /** Directory under `outDir` holding the per-human payloads. */
  payloadDir: string;
  /**
   * Where the built PDFs are read from, relative to the repo root. Each human's
   * are matched by the `<human>-` filename prefix run-cv asks for.
   */
  pdfDir: string;
  /**
   * Salt for the payload directory names. Permanent: changing it invalidates
   * every `?h=` link anyone has shared.
   */
  hashSalt: string;
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/** Input shape: everything optional except what has no sensible default. */
export type RunCvWebInput = DeepPartial<Omit<RunCvWebConfig, "source" | "humans">> & {
  source: SourceConfig;
  humans: readonly string[];
};

export const DEFAULT_PROMPT: PromptConfig = {
  enabled: false,
  label: "npx run-cv",
  placeholder: "name",
  note: "",
};

export const DEFAULT_TERMINAL: TerminalConfig = {
  needColumns: 81,
  needRows: 47,
  maxFont: 14,
  minFont: 6,
  theme: {
    background: "#050a06",
    foreground: "#b8ffc6",
    cursor: "#7dff9a",
    selectionBackground: "#173a22",
  },
};

/** A human's name becomes a filesystem path and a URL parameter. */
const VALID_HUMAN = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Validates and fills in a config. Throws rather than guessing: a wrong
 * `basePath` produces a page whose assets 404 with no other symptom, so it is
 * worth failing at build time with a sentence that says what to fix.
 */
export function defineRunCvWeb(input: RunCvWebInput): RunCvWebConfig {
  if (input.humans.length === 0) {
    throw new Error("run-cv-web config: `humans` must list at least one human.");
  }
  for (const human of input.humans) {
    if (!VALID_HUMAN.test(human)) {
      throw new Error(
        `run-cv-web config: invalid human name ${JSON.stringify(human)}. ` +
          "Use lowercase letters, digits and hyphens — it becomes both a path and a URL parameter.",
      );
    }
  }
  const duplicate = input.humans.find((h, i) => input.humans.indexOf(h) !== i);
  if (duplicate) {
    throw new Error(`run-cv-web config: duplicate human ${JSON.stringify(duplicate)}.`);
  }

  const basePath = input.basePath ?? "/run-cv/";
  if (!basePath.startsWith("/") || !basePath.endsWith("/")) {
    throw new Error(
      `run-cv-web config: \`basePath\` must start and end with "/" (got ${JSON.stringify(basePath)}).`,
    );
  }

  if (input.source.mode === "src" && path.isAbsolute(input.source.entry)) {
    throw new Error("run-cv-web config: `source.entry` must be relative to the repo root.");
  }

  const prompt: PromptConfig = { ...DEFAULT_PROMPT, ...input.prompt };
  if (prompt.enabled && !input.hashSalt) {
    throw new Error(
      "run-cv-web config: `prompt.enabled` needs a `hashSalt`. It names the directory each " +
        "human's payload is served from, so without one the page cannot find anybody. Pick any " +
        "string and keep it: changing it later invalidates every shared `?h=` link.",
    );
  }

  const payloadDir = input.payloadDir ?? "h";
  if (payloadDir.includes("/") || payloadDir.startsWith(".")) {
    throw new Error(
      `run-cv-web config: \`payloadDir\` must be a single directory name (got ${JSON.stringify(payloadDir)}).`,
    );
  }

  const terminal: TerminalConfig = {
    ...DEFAULT_TERMINAL,
    ...input.terminal,
    theme: { ...DEFAULT_TERMINAL.theme, ...input.terminal?.theme },
  };
  if (terminal.minFont > terminal.maxFont) {
    throw new Error("run-cv-web config: `terminal.minFont` cannot exceed `terminal.maxFont`.");
  }

  return {
    source: input.source,
    humans: [...input.humans],
    outDir: input.outDir ?? "public/run-cv",
    basePath,
    virtualDist: input.virtualDist ?? "/run-cv/dist",
    cvUrl: input.cvUrl ?? `${basePath}cv.pdf`,
    homedir: input.homedir ?? "/home/visitor",
    terminal,
    page: {
      title: input.page?.title ?? "run-cv — terminal in your browser",
      hint: input.page?.hint ?? "↑↓ move · → open · ← back · q quit · Tab leaves",
    },
    prompt,
    payloadDir,
    pdfDir: input.pdfDir ?? "public",
    hashSalt: input.hashSalt ?? "",
  };
}

/** The slice serialised into the bundle as `virtual:run-cv-web-config`. */
export function toBrowserConfig(config: RunCvWebConfig): BrowserConfig {
  return {
    cvUrl: config.cvUrl,
    homedir: config.homedir,
    virtualDist: config.virtualDist,
    // Deliberately absent under the prompt — see BrowserConfig.
    ...(config.prompt.enabled ? {} : { humans: config.humans }),
    terminal: config.terminal,
    prompt: config.prompt,
    payloadBase: `${config.basePath}${config.payloadDir}/`,
    hashSalt: config.hashSalt,
  };
}
