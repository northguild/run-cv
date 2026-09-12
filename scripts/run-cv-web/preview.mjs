// Serves docs/ the way GitHub Pages serves this project site.
//
// This exists because `npx serve docs` is *wrong* here: Pages puts the repo at
// /run-cv/, so the built page's absolute asset URLs are /run-cv/run-cv/...,
// and a server rooted at docs/ 404s every one of them. Getting the prefix
// right locally is the only way to catch a bad `basePath` before deploying.
//
//   pnpm preview:web   ->  http://localhost:4173/run-cv/

import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DOCS = fileURLToPath(new URL("../../docs", import.meta.url));
const PREFIX = "/run-cv/";
const PORT = Number(process.env.PORT ?? 4173);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

createServer(async (request, response) => {
  const { pathname } = new URL(request.url ?? "/", "http://localhost");

  if (pathname === "/") {
    response.writeHead(302, { location: PREFIX }).end();
    return;
  }
  if (!pathname.startsWith(PREFIX)) {
    response.writeHead(404, { "content-type": "text/plain" }).end(`Not found — try ${PREFIX}`);
    return;
  }

  let relative = decodeURIComponent(pathname.slice(PREFIX.length));
  if (relative === "" || relative.endsWith("/")) relative += "index.html";

  // Never serve outside docs/, whatever the request says.
  const file = path.join(DOCS, relative);
  if (!file.startsWith(DOCS)) {
    response.writeHead(403, { "content-type": "text/plain" }).end("Forbidden");
    return;
  }

  try {
    const body = await readFile(file);
    response
      .writeHead(200, {
        "content-type": TYPES[path.extname(file)] ?? "application/octet-stream",
        // The gate fetches payloads; stale ones make a rebuild look broken.
        "cache-control": "no-store",
      })
      .end(body);
  } catch {
    response.writeHead(404, { "content-type": "text/plain" }).end(`404 ${relative}`);
  }
}).listen(PORT, () => {
  console.log(`\n  run-cv landing page   http://localhost:${PORT}${PREFIX}`);
  console.log(`  terminal only         http://localhost:${PORT}${PREFIX}run-cv/\n`);
  console.log("  Serving docs/ — run `pnpm build:web` after changing the terminal.\n");
});
