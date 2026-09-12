import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const fixture = (name: string) =>
  fileURLToPath(
    new URL(`./scripts/run-cv-web/tests/fixtures/${name}`, import.meta.url),
  );

/**
 * The browser shims import modules that only exist inside the esbuild bundle.
 * Point them at fixtures so the shims can be tested as ordinary modules.
 */
const virtualAliases = {
  "virtual:run-cv-files": fixture("virtual-files.ts"),
  "virtual:run-cv-web-config": fixture("virtual-config.ts"),
  // `ink` is private to run-cv under pnpm; the bundler resolves it from there.
  ink: fixture("ink.ts"),
};

/**
 * Three projects. The CLI's own tests keep the globals they were written with,
 * while the run-cv browser build's two halves need different environments: the
 * Node-side esbuild orchestration, and the browser shims it bundles. Splitting
 * those keeps `document` out of reach of the build code, so a shim that
 * accidentally depends on the DOM fails loudly here rather than silently in the
 * page.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "app",
          globals: true,
          environment: "node",
          include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
          exclude: ["**/node_modules/**", "scripts/run-cv-web/**"],
        },
      },
      {
        test: {
          name: "build",
          environment: "node",
          include: [
            "scripts/run-cv-web/tests/*.test.ts",
            "scripts/run-cv-web/tests/integration/*.test.ts",
          ],
        },
      },
      {
        resolve: { alias: virtualAliases },
        test: {
          name: "browser",
          environment: "jsdom",
          include: ["scripts/run-cv-web/tests/browser/*.test.ts"],
        },
      },
    ],
  },
});
