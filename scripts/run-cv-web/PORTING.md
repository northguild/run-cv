# Porting run-cv-web to another repo

> **This copy has been ported already** — into `northguild/run-cv`, which is the reference port
> the rest of this document describes. It has since diverged from the blueprint in
> `craig-o-curtis.github.io`; see "Divergences from the blueprint" at the end before syncing
> either direction.

This folder is self-contained. Copy it, add the devDependencies, edit one config file.

The reference port is **northguild/run-cv** replacing its dead StackBlitz embed with a terminal
it builds itself. Everything below was checked against that repo's source.

## 1. Copy the folder and add dependencies

```bash
cp -r scripts/run-cv-web <target-repo>/scripts/run-cv-web
```

```bash
pnpm add -D esbuild @xterm/xterm @xterm/addon-fit memfs \
            buffer events util path-browserify stream-browserify
```

run-cv already has TypeScript and Vitest, so `tests/` drops straight in. Add the vitest
`projects` entry and the virtual-module aliases from this repo's `vitest.config.mts` — the
browser shims import `virtual:run-cv-files`, `virtual:run-cv-web-config` and `ink`, none of
which Vite can resolve on its own.

## 2. Edit `run-cv-web.config.ts`

```ts
export default defineRunCvWeb({
  source: { mode: "src", entry: "src/cli.tsx" },
  humans: ["craig", "baldur"],
  outDir: "docs/run-cv",
  basePath: "/run-cv/run-cv/",
  virtualDist: "/run-cv/dist",
  cvUrl: "/run-cv/run-cv/craig-cv.pdf",
});
```

- **`source.mode: "src"`** bundles the repo's own `src/cli.tsx`, so the page tracks `main`
  instead of the last npm release. esbuild compiles the TSX directly.
- **`humans`** with two entries makes the human selectable: `?human=baldur`, validated against
  the allowlist. The StackBlitz embed never offered this.
- **`basePath`** is the one value most likely to be wrong. northguild/run-cv is a *project*
  site, so Pages serves the repo at `/run-cv/` and `docs/run-cv/` lands at `/run-cv/run-cv/`.
  Verify against a real deploy; a wrong value 404s every asset with no other symptom.

## 3. Expect one plugin change — `import.meta.url` beyond the entry

**This is the only real code change, and it will not be obvious from a stack trace.**

`src/shims-plugin.ts` rewrites `import.meta.url` so run-cv believes it lives at `virtualDist`.
Today that rewrite is scoped to the *program entry file*, which is all the npm build needs:
`dist/cli.js` is a single bundled file.

run-cv's source is not bundled yet, and reads its own location in **three** places:

| File | Line | Use |
|---|---|---|
| `src/cli.tsx` | 18 | `importMeta: import.meta` passed to meow |
| `src/cvParser.ts` | 7 | `__dirname` → `path.join(__dirname, "humans")` |
| `src/App.tsx` | 39-40 | `__dirname` → `path.resolve(__dirname, "pdf")` |

Only the first is covered. Widen the `onLoad` filter from the exact entry path to every file
under the source directory, applying the same two replacements. `programEntryFilter()` is
already exported and tested; add a directory filter beside it.

The good news: once rewritten, the paths line up on their own. `cvParser` resolves
`<virtualDist>/humans`, which is exactly where `collectHumanFiles` seeds the markdown, and
`App.tsx` resolves `<virtualDist>/pdf`, which is the directory the `fs` shim intercepts.

## 4. What will *not* be a problem

Checked against run-cv's source, so nobody re-derives it:

- **Node built-ins used:** `node:path`, `node:fs`, `node:fs/promises`, `node:url`, `node:os`.
  All already mapped in `src/module-map.ts`. No new shims needed.
- **`nodemailer`** is in `dependencies` but **never imported from `src/`**, so it never reaches
  the bundle. Were it imported, it would pull in `net`/`tls`/`dns` and need stubbing.
- **`uuid`**, **`marked`**, **`gray-matter`** are browser-safe; `gray-matter` wants `Buffer`,
  which the polyfill already injects.
- **The `meow` stub** replaces `src/cli.tsx`'s meow call, so `importMeta` there is moot once the
  rewrite lands.

## 5. Wire up the build and replace the embed

Add to `package.json`:

```json
"build:web": "node scripts/run-cv-web/build.mjs"
```

Unlike this repo — where `public/run-cv/` is generated and git-ignored — a project site serving
from `docs/` needs the artifacts **committed**, or run `build:web` in CI and publish from there.

Then in `docs/index.html` (~line 93), replace the StackBlitz iframe `src`:

```diff
-  src="https://stackblitz.com/edit/run-cv?ctl=1&embed=1&file=index.js&hideExplorer=1&...&view=editor"
+  src="/run-cv/run-cv/index.html"
+  sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
+  referrerpolicy="no-referrer"
```

Keep the `.monitor-frame` CRT styling and `loading="lazy"` — the 1.2 MB bundle should not load
until it is needed.

Rewrite the caption below it. It currently reads *"Click **Run Project** to boot. Once
initialized, execute: `> npx run-cv <name>`"*, which describes StackBlitz's UI. The terminal is
now already running.

Finally, delete the StackBlitz project and close the stale TODOs.

## 6. Verify

```bash
pnpm build:web && pnpm test && pnpm typecheck
```

The integration test's module-graph assertion **will fail on the first run** — the graph is this
repo's. Regenerate the fixture (see README, "What breaks on a run-cv upgrade"), then read the
diff carefully: it is the single best review of what bundling from source actually pulled in.
Re-baseline the size band at the same time.

Then load the page and check: the terminal boots, arrows navigate, `q` quits and Restart works,
`?human=baldur` switches CV, the PDF action opens a real file, and `Tab` leaves the terminal.

---

## Issue-ready summary

> **Replace the StackBlitz embed with a self-hosted terminal**
>
> The landing page iframes `stackblitz.com/edit/run-cv`, which now renders editor-only with no
> terminal, so the demo is broken.
>
> craig-o-curtis.github.io has a working browser build of run-cv: esbuild bundles the CLI with
> Node shims, memfs holds the markdown, Ink renders into xterm.js. No server, no runtime fetch,
> no shell. It is TypeScript, config-driven and covered by 147 tests including a real build.
>
> **Plan:** copy `scripts/run-cv-web/`, point `run-cv-web.config.ts` at our own `src/cli.tsx`
> (so the page tracks `main`, and both humans are selectable via `?human=`), output to
> `docs/run-cv/`, and swap the iframe `src`.
>
> **Known work:** the `import.meta.url` rewrite currently covers only the entry file; our source
> reads its own location in `cli.tsx`, `cvParser.ts` and `App.tsx`, so the rewrite must widen to
> the whole source directory. Everything else — built-ins, deps — is already covered.
>
> **Acceptance:** terminal boots on the landing page; both humans reachable; `q` and Restart
> work; no StackBlitz reference remains; CI green with a re-baselined module graph.


---

## Divergences from the blueprint (northguild/run-cv)

Recorded so a future re-sync with `craig-o-curtis.github.io/scripts/run-cv-web` is a readable
diff rather than a surprise. Everything here is additive and gated on config, so the blueprint's
own behaviour is unchanged when `prompt.enabled` is false.

**New, because this landing page must not name anyone:**

| File | What it adds |
|---|---|
| `shared/human-hash.ts` | `hashHuman()`, imported by the builder *and* the page so they cannot drift. |
| `src/payloads.ts` | Pure: pairs each human with their hash, files and PDFs. |
| `browser/gate.ts` | The prompt: hash the input, fetch the payload, seed, then import. |
| `browser/shims/session.ts` | Holds the typed name for the `meow` stub and the `open` shim. |
| `preview.mjs` | Local server matching the Pages project-site path layout. |

**Changed:**

- `src/config.ts` — `prompt`, `hashSalt`, `payloadDir`, `pdfDir`. `toBrowserConfig` **omits
  `humans`** when the prompt is on.
- `src/main.ts` — passes `humanFiles: {}` when gated and writes `h/<hash>/` instead.
- `src/module-map.ts` — a third `meow` branch reading the session.
- `browser/shims/fs.ts` — `createRunCvFs` returns `{ fs, seed }`; the volume starts empty.
- `browser/shims/open.ts` — `classifyTarget` takes a resolver and uses the PDF's basename, so
  all of a human's PDFs work rather than one site-wide `cvUrl`.
- `browser/entry.ts` — `await runGate()` then a **dynamic** import of the program.
- `browser/setup.ts` — `focusTerminal()` is exported and deferred; Restart drops the query
  string.

**Fixes that belong upstream too** (they are not about anonymity):

1. **`sourceDirFilter()` in `src/shims-plugin.ts`.** This is PORTING.md §3 above, implemented.
   The `import.meta.url` rewrite now covers every `.ts`/`.tsx` under the source directory, not
   just the entry. Test files are excluded inside the callback because esbuild's filters are RE2
   and have no negative lookahead.
2. **A three-way loader on that handler.** It was `tsx` or `js`; a `.ts` file carrying type
   annotations fails under `js`, which is every file the widened filter newly matches.
3. **`jsx: "automatic"` in the esbuild options.** Only bites in `mode: "src"` — a published
   run-cv is already compiled, but source `.tsx` still has JSX, and esbuild's default classic
   runtime produces a bare `React is not defined` at runtime with no build error.
4. **`target: "node20"` in `build.mjs`**, matching this repo's pinned CI.
