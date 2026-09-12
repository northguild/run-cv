import path from "node:path";
import type { Metafile } from "esbuild";

/** One line summarising what the build produced. */
export function formatBuildSummary(metafile: Metafile, root: string, packageCount: number): string {
  const outputs = Object.entries(metafile.outputs).map(
    ([file, { bytes }]) => `${path.relative(root, file)} ${(bytes / 1024).toFixed(0)} KB`,
  );
  return `run-cv web build → ${outputs.join(", ")} · ${packageCount} bundled packages listed`;
}
