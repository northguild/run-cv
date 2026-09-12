// The name prompt.
//
// Nothing about who is on this site reaches the browser until someone types a
// name: the bundle ships with an empty filesystem, and each human's markdown
// sits at `<payloadBase><sha256(salt + name)>/payload.json`, which is only
// fetched once the typed name hashes to it.
//
// A miss deliberately boots anyway. run-cv finds no `introduction.md`, its own
// `catch` sets "ACCESS DENIED", and `AccessDenied.tsx` renders — the
// wrong-name screen is already written, already on-theme, and better than
// anything a form-level error message would say.
import config from "virtual:run-cv-web-config";
import { hashHuman } from "../shared/human-hash.js";
import { focusTerminal } from "./setup.js";
import { seed } from "./shims/fs.js";
import { setSession } from "./shims/session.js";

interface Payload {
  human: string;
  files: Record<string, string>;
  pdfs: string[];
}

/** Where a hash's payload and PDFs live. */
function locate(hash: string): { payload: string; pdfBase: string } {
  const base = `${config.payloadBase}${hash}/`;
  return { payload: `${base}payload.json`, pdfBase: `${base}pdf/` };
}

async function unlock(typed: string): Promise<void> {
  const hash = await hashHuman(typed, config.hashSalt);
  const { payload, pdfBase } = locate(hash);

  let found: Payload | undefined;
  try {
    const response = await fetch(payload, { cache: "no-store" });
    if (response.ok) found = (await response.json()) as Payload;
  } catch {
    // Offline or blocked: indistinguishable from a wrong name, and it leads to
    // the same screen, so there is nothing useful to tell the visitor here.
  }

  // Even on a miss the session gets the typed name. With an empty one run-cv
  // takes its `if (!name)` branch and prints "Please provide a human name",
  // which is the wrong screen for someone who did provide one.
  setSession(found?.human ?? typed, pdfBase);
  if (found) seed(found.files);
}

/** Resolves once the program may be imported. */
export async function runGate(): Promise<void> {
  if (!config.prompt.enabled) return;

  // A shared `?h=` link boots without the visitor typing anything. The hash is
  // already the secret, so there is nothing left to check.
  const deepLink = new URLSearchParams(location.search).get("h");
  if (deepLink && /^[0-9a-f]{64}$/.test(deepLink)) {
    const { payload, pdfBase } = locate(deepLink);
    try {
      const response = await fetch(payload, { cache: "no-store" });
      if (response.ok) {
        const found = (await response.json()) as Payload;
        setSession(found.human, pdfBase);
        seed(found.files);
        start();
        return;
      }
    } catch {
      // Fall through to the form.
    }
    setSession("", pdfBase);
    start();
    return;
  }

  const form = document.getElementById("gate") as HTMLFormElement | null;
  const input = document.getElementById("gate-input") as HTMLInputElement | null;
  if (!form || !input) throw new Error("run-cv-web: the page is missing its gate form.");

  input.focus();

  await new Promise<void>((resolve) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const typed = input.value.trim();
      if (!typed) return;
      input.disabled = true;
      void unlock(typed).then(() => {
        start();
        resolve();
      });
    });
  });
}

function start(): void {
  document.body.dataset.state = "running";
  focusTerminal();
}
