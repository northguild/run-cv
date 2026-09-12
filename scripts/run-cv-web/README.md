# run-cv in the browser

Bundles the [`run-cv`](https://www.npmjs.com/package/run-cv) terminal CV into a static page:
esbuild swaps Node's built-ins for browser shims, an in-memory filesystem holds the human's
markdown, and Ink renders into xterm.js.

There is no server and no shell. The page runs exactly one program.

**This copy is gated.** The landing page is public, so nothing identifying ships in the bundle:
the page boots to an `npx run-cv ___` prompt with an empty filesystem, and each human's markdown
lives at `h/<sha256(salt + name)>/payload.json`, fetched only once someone types a name that
hashes to it. A wrong name seeds nothing and falls through to run-cv's own ACCESS DENIED screen.

That makes the CVs *unpublished*, not secret — the salt ships in the bundle, so someone who
already knows a name can still derive its directory. It stops crawlers, scrapers and `curl`,
which is what it is for. Don't describe it as more than that.

```
pnpm build:web           # → docs/run-cv/{index.html,terminal.js,terminal.css,...} + h/<hash>/
pnpm preview:web         # serves docs/ the way Pages does — see below
pnpm test                # unit + a real build, compared against the committed module graph
pnpm typecheck
```

**Always preview with `pnpm preview:web`, never `npx serve docs`.** This is a *project* site, so
Pages serves the repo under `/run-cv/` and the page's absolute asset URLs are
`/run-cv/run-cv/...`. A server rooted at `docs/` 404s every one of them, and a wrong `basePath`
looks exactly the same — getting the prefix right locally is the only way to tell them apart
before deploying.

`RUN_CV_WEB_DEBUG=1` keeps names readable and adds source maps. `RUN_CV_WEB_OUT` redirects the
output directory. `RUN_CV_METAFILE` writes esbuild's metafile, which is how the module-graph
fixture is regenerated.

## Layout

| Path | What it is |
|---|---|
| `run-cv-web.config.ts` | **The only file you edit when porting this.** |
| `build.mjs` | Entry point. Compiles `src/main.ts` with esbuild, then runs it. |
| `src/main.ts` | Orchestrator: clean, bundle, render the page, write licences. |
| `src/config.ts` | Config types, defaults and validation. |
| `src/module-map.ts` | What each Node module becomes in the browser. |
| `src/shims-plugin.ts` | The esbuild plugin: resolution and source rewriting. |
| `src/human-files.ts` | Reads the markdown, per human and merged. |
| `src/payloads.ts` | Pairs each human with the hash their payload is served from. |
| `shared/human-hash.ts` | The hash. Imported by *both* halves, so they cannot drift. |
| `browser/gate.ts` | The name prompt: hash, fetch, seed, then import the program. |
| `preview.mjs` | Local server that mimics the Pages path layout. |
| `src/licences.ts` | Third-party licence manifest, with copyleft texts inlined. |
| `src/page.ts` | `index.html` token substitution. |
| `browser/` | Everything that ships to the browser: the shims, the xterm wiring. |
| `tests/` | Unit tests, plus `integration/` which runs the real pipeline. |

`build.mjs` exists because the builder is TypeScript and this repo has no TS runner. It compiles
`src/main.ts` with the esbuild the build already depends on, then imports the result. That keeps
the folder dependency-free beyond what bundling already needs. Because the builder is compiled
away from its own directory, `import.meta.url` cannot locate it — `build.mjs` injects
`__RUN_CV_WEB_DIR__` and `__REPO_ROOT__` instead.

## Porting this to another repo

See [PORTING.md](./PORTING.md). In short: copy the folder, add the devDependencies, edit
`run-cv-web.config.ts`.

## Why each shim exists

| Shim | Why |
|---|---|
| `process` | stdout/stderr write to xterm, stdin is fed by keystrokes, `exit` ends the session. |
| `fs` / `fs-promises` | memfs holding only the human's markdown. Also makes the *unbundled* PDFs look present, so run-cv's download path works — `open` then sends the visitor to the real CV. |
| `open` | Only `https:` and `mailto:` may leave the page, always without an opener. Everything else throws. |
| `ink` | Same Ink, but with `patchConsole` and `exitOnCtrlC` off, and the page told when the app quits. |
| `util` | The polyfill plus `isDeepStrictEqual`, which it does not ship. |
| `globals` | Injects `process`, `Buffer` and `setImmediate`, which Ink's unmount needs. |

And the stubs, in `src/module-map.ts`: `os`, `tty`, `url`, `child_process`, `module`, `crypto`,
`signal-exit`, `patch-console`, `is-in-ci`, `terminal-size`, `meow`, `supports-color`, `ws`,
`react-devtools-core`. Two are load-bearing rather than inert:

- **`meow`** supplies the human's name, since a page has no argv. One human is fixed; several
  become selectable with `?human=<name>`; and under `prompt.enabled` it reads whatever the
  visitor typed out of `browser/shims/session.ts`. That last branch interpolates **no name and
  no allowlist** — one `JSON.stringify(humans)` there would put every name back into
  `terminal.js` and undo the gate.
- **`supports-color`** forces truecolor. Chalk's own browser check would otherwise drop colour
  everywhere outside Chromium.

## What breaks on a run-cv upgrade

The integration test catches all of these — it rebuilds and diffs the module graph against
`tests/fixtures/module-graph.json`.

1. **A new Node built-in import.** It appears in the graph as a real Node module. Add a shim or
   a stub in `src/module-map.ts`.
2. **A new dependency that assumes Node.** Same symptom.
3. **A changed `import.meta` shape.** `src/shims-plugin.ts` rewrites `import.meta.url` so run-cv
   believes it lives at `virtualDist`; if upstream reads its location differently, the markdown
   is not found.
4. **A different cfonts font.** Only `tiny` is statically included; any other is a runtime error.
5. **Content changes.** `run-cv@0.2.3` removed contact details from `craig/contact.md`. Nothing
   but the dedicated assertion in the integration test would have noticed.
6. **The markdown returning to the bundle.** The `anonymity` block in
   `tests/integration/build.test.ts` is the only thing standing between a refactor and quietly
   republishing both CVs. A page that leaks this still looks and works perfectly.

To accept a legitimate change, regenerate the fixture:

```bash
RUN_CV_METAFILE=/tmp/meta.json pnpm build:run-cv
# then normalise pnpm's versioned store paths — see tests/integration/build.test.ts
```
