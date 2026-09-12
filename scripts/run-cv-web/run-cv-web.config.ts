// The only file to edit when porting this folder to another repo.
//
// See README.md for the contract. Nothing else in scripts/run-cv-web/ should
// hardcode a path, a colour or a human's name.
import { defineRunCvWeb } from "./src/config.js";

export default defineRunCvWeb({
  // This repo owns run-cv's source, so the page tracks HEAD rather than the
  // last npm release. esbuild compiles the TSX directly.
  source: { mode: "src", entry: "src/cli.tsx" },
  humans: ["craig", "baldur"],
  // A project site: Pages serves the repo at /run-cv/, so docs/run-cv/ lands
  // at /run-cv/run-cv/. Wrong here and every asset 404s with no other symptom.
  outDir: "docs/run-cv",
  basePath: "/run-cv/run-cv/",
  virtualDist: "/run-cv/dist",

  // The landing page is public, so no CV content ships in the bundle: each
  // human's markdown is written to h/<sha256(hashSalt + name)>/ and fetched
  // only once a visitor types a name that hashes to it.
  //
  // The salt is permanent. Changing it renames every payload directory and
  // invalidates every `?h=` link anyone has shared.
  hashSalt: "northguild/run-cv · terminal gate · v1",
  prompt: {
    enabled: true,
    label: "npx run-cv",
    placeholder: "name",
    note: "Enter the name you were given.",
  },

  // Matched to the landing page that frames this: black ground, #00ff00 on it.
  // The terminal sits inside that page's CRT monitor, so any other palette
  // reads as a pasted-in iframe.
  terminal: {
    theme: {
      background: "#000000",
      foreground: "#00ff00",
      cursor: "#00ff00",
      selectionBackground: "#003300",
    },
  },

  page: { title: "run-cv" },
});
