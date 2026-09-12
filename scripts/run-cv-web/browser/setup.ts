import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import config from "virtual:run-cv-web-config";
import { attachTerminal, onExit, resize, stdin } from "./shims/process.js";
import { pickFontSize } from "./terminal-sizing.js";

const { terminal: bounds } = config;

const host = document.getElementById("terminal");
if (!host) throw new Error("run-cv-web: the page is missing its #terminal element.");

const term = new Terminal({
  fontFamily: 'Menlo, "SF Mono", SFMono-Regular, Consolas, "Liberation Mono", monospace',
  fontSize: bounds.maxFont,
  cursorBlink: false,
  // A real TTY turns "\n" into "\r\n"; Ink relies on it.
  convertEol: true,
  scrollback: 200,
  // run-cv picks its own colours (e.g. grey hints). xterm nudges any that fall
  // below 7:1 against the background, keeping the terminal at WCAG AAA.
  minimumContrastRatio: 7,
  theme: bounds.theme,
});
const fit = new FitAddon();
term.loadAddon(fit);
term.open(host);

function sizeToHost(): void {
  pickFontSize(term, fit, bounds);
  fit.fit();
  resize(term.cols, term.rows);
}
sizeToHost();
new ResizeObserver(sizeToHost).observe(host);

attachTerminal(term);
term.onData((data) => stdin.push(data));
// Tab leaves the terminal instead of being typed into it (SC 2.1.2: no keyboard trap).
term.attachCustomKeyEventHandler((event) => event.key !== "Tab");

/**
 * Deferred rather than done here: under the gate the visitor is typing into the
 * name input at this point, and a terminal that grabs focus on module eval
 * swallows their keystrokes. The gate calls this once the program starts.
 */
export function focusTerminal(): void {
  term.focus();
}

if (!config.prompt.enabled) focusTerminal();

onExit(() => {
  document.body.dataset.state = "ended";
  document.getElementById("restart")?.focus();
});

// A restart is a fresh page: a new JavaScript realm, nothing carried over.
// Dropping the query string with it means a `?h=` deep link restarts at the
// prompt rather than straight back into the same person's CV.
document.getElementById("restart")?.addEventListener("click", () => {
  location.replace(location.pathname);
});
