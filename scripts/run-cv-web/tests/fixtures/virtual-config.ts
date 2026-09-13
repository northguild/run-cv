import type { BrowserConfig } from "../../src/config.js";
import { DEFAULT_PROMPT, DEFAULT_TERMINAL } from "../../src/config.js";

/** Stands in for `virtual:run-cv-web-config` under test. */
const config: BrowserConfig = {
  cvUrl: "/site-cv.pdf",
  homedir: "/home/visitor",
  virtualDist: "/run-cv/dist",
  humans: ["craig"],
  terminal: DEFAULT_TERMINAL,
  prompt: DEFAULT_PROMPT,
  payloadBase: "/run-cv/h/",
  hashSalt: "test-salt",
};
export default config;
