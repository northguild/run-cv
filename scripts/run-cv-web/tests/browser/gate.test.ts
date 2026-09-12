import config from "virtual:run-cv-web-config";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashHuman } from "../../shared/human-hash.js";

// setup.ts builds a real xterm Terminal on import, which the gate does not need
// and jsdom cannot usefully provide.
const focusTerminal = vi.fn();
vi.mock("../../browser/setup.js", () => ({
  focusTerminal: () => focusTerminal(),
}));

const seed = vi.fn();
vi.mock("../../browser/shims/fs.js", () => ({
  seed: (files: unknown) => seed(files),
}));

const setSession = vi.fn();
vi.mock("../../browser/shims/session.js", () => ({
  setSession: (name: string, base: string) => setSession(name, base),
}));

const { runGate } = await import("../../browser/gate.js");

const SALT = config.hashSalt;
const PAYLOAD = {
  human: "craig",
  files: { "/run-cv/dist/humans/craig/introduction.md": "# HI" },
  pdfs: [],
};

function renderGate(): HTMLInputElement {
  document.body.dataset.state = "gate";
  document.body.innerHTML = `<form id="gate"><input id="gate-input" /><button type="submit">RUN</button></form>`;
  return document.getElementById("gate-input") as HTMLInputElement;
}

function submit(input: HTMLInputElement, value: string): void {
  input.value = value;
  (document.getElementById("gate") as HTMLFormElement).dispatchEvent(
    new Event("submit", { cancelable: true, bubbles: true }),
  );
}

/** Serves the payload only at the hash of `known`, as GitHub Pages would. */
function serveOnly(known: string): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const hash = await hashHuman(known, SALT);
      return url.includes(hash)
        ? { ok: true, json: async () => PAYLOAD }
        : { ok: false, json: async () => ({}) };
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  config.prompt = { ...config.prompt, enabled: true };
  window.history.replaceState({}, "", "/");
});

describe("runGate", () => {
  it("does nothing when the prompt is off, so the blueprint's behaviour is unchanged", async () => {
    config.prompt = { ...config.prompt, enabled: false };
    document.body.innerHTML = "";
    await expect(runGate()).resolves.toBeUndefined();
    expect(setSession).not.toHaveBeenCalled();
  });

  it("fetches the payload for the typed name and seeds the filesystem", async () => {
    serveOnly("craig");
    const input = renderGate();
    const running = runGate();
    submit(input, "craig");
    await running;

    const hash = await hashHuman("craig", SALT);
    expect(fetch).toHaveBeenCalledWith(`${config.payloadBase}${hash}/payload.json`, {
      cache: "no-store",
    });
    expect(seed).toHaveBeenCalledWith(PAYLOAD.files);
    expect(setSession).toHaveBeenCalledWith("craig", `${config.payloadBase}${hash}/pdf/`);
    expect(document.body.dataset.state).toBe("running");
  });

  // The wrong-name path. run-cv renders its own ACCESS DENIED from an empty
  // filesystem, which is why nothing is seeded and the boot still happens.
  it("boots with nothing seeded when the name is unknown", async () => {
    serveOnly("craig");
    const input = renderGate();
    const running = runGate();
    submit(input, "nobody");
    await running;

    expect(seed).not.toHaveBeenCalled();
    expect(document.body.dataset.state).toBe("running");
  });

  // With an empty name run-cv prints "Please provide a human name" instead,
  // which is the wrong screen for someone who did provide one.
  it("still sets the typed name on a miss, so ACCESS DENIED is what renders", async () => {
    serveOnly("craig");
    const input = renderGate();
    const running = runGate();
    submit(input, "nobody");
    await running;

    expect(setSession).toHaveBeenCalledWith("nobody", expect.any(String));
  });

  it("ignores an empty submission rather than booting a locked terminal", async () => {
    serveOnly("craig");
    const input = renderGate();
    const running = runGate();
    submit(input, "   ");
    expect(setSession).not.toHaveBeenCalled();
    expect(document.body.dataset.state).toBe("gate");

    submit(input, "craig");
    await running;
    expect(document.body.dataset.state).toBe("running");
  });

  it("treats a network failure as a miss rather than hanging", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    const input = renderGate();
    const running = runGate();
    submit(input, "craig");
    await running;

    expect(seed).not.toHaveBeenCalled();
    expect(document.body.dataset.state).toBe("running");
  });

  it("focuses the terminal only once the program is about to run", async () => {
    serveOnly("craig");
    const input = renderGate();
    const running = runGate();
    expect(focusTerminal).not.toHaveBeenCalled();
    submit(input, "craig");
    await running;
    expect(focusTerminal).toHaveBeenCalled();
  });

  describe("?h= deep links", () => {
    it("boots straight from a shared hash without showing the form", async () => {
      serveOnly("craig");
      const hash = await hashHuman("craig", SALT);
      window.history.replaceState({}, "", `/?h=${hash}`);
      document.body.innerHTML = "";

      await runGate();
      expect(seed).toHaveBeenCalledWith(PAYLOAD.files);
      expect(setSession).toHaveBeenCalledWith("craig", `${config.payloadBase}${hash}/pdf/`);
    });

    it("falls back to the form for anything that is not a hash", async () => {
      serveOnly("craig");
      window.history.replaceState({}, "", "/?h=../../etc/passwd");
      const input = renderGate();
      const running = runGate();
      expect(fetch).not.toHaveBeenCalled();
      submit(input, "craig");
      await running;
      expect(seed).toHaveBeenCalled();
    });

    it("boots locked for a well-formed hash that matches nobody", async () => {
      serveOnly("craig");
      window.history.replaceState({}, "", `/?h=${"0".repeat(64)}`);
      document.body.innerHTML = "";

      await runGate();
      expect(seed).not.toHaveBeenCalled();
      expect(document.body.dataset.state).toBe("running");
    });
  });
});
