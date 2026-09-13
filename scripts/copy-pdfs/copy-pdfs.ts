import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface CopyStaticPdfsOptions {
  publicDir: string;
  distPdfDir: string;
  stdout?: Pick<NodeJS.WriteStream, "write">;
}

interface CopyStaticPdfsResult {
  copiedFiles: string[];
  removedFiles: string[];
  distPdfDir: string;
}

export function getCopyPdfPaths() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  return {
    publicDir: path.resolve(__dirname, "../../public"),
    distPdfDir: path.resolve(__dirname, "../../dist/pdf"),
  };
}

function listPdfs(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.toLowerCase().endsWith(".pdf"));
}

export function copyStaticPdfs({
  publicDir,
  distPdfDir,
  stdout = process.stdout,
}: CopyStaticPdfsOptions): CopyStaticPdfsResult {
  const resolvedPublicDir = path.resolve(publicDir);
  const resolvedDistPdfDir = path.resolve(distPdfDir);

  if (!fs.existsSync(resolvedPublicDir)) {
    throw new Error(`Public directory not found: ${resolvedPublicDir}`);
  }

  fs.mkdirSync(resolvedDistPdfDir, { recursive: true });

  const files = listPdfs(resolvedPublicDir);

  if (files.length === 0) {
    throw new Error(`No PDF files found in ${resolvedPublicDir}`);
  }

  // A PDF deleted from public/ must not linger in dist/pdf/: run-cv offers a
  // static download only when its file is packaged.
  const removedFiles = listPdfs(resolvedDistPdfDir).filter(
    (name) => !files.includes(name),
  );
  for (const file of removedFiles) {
    fs.rmSync(path.join(resolvedDistPdfDir, file));
  }

  for (const file of files) {
    const source = path.join(resolvedPublicDir, file);
    const target = path.join(resolvedDistPdfDir, file);
    fs.copyFileSync(source, target);
  }

  stdout.write(
    `Copied ${files.length} static PDF file(s) to ${resolvedDistPdfDir}\n`,
  );
  if (removedFiles.length > 0) {
    stdout.write(
      `Removed ${removedFiles.length} stale PDF file(s): ${removedFiles.join(", ")}\n`,
    );
  }

  return {
    copiedFiles: files,
    removedFiles,
    distPdfDir: resolvedDistPdfDir,
  };
}

function main() {
  const { publicDir, distPdfDir } = getCopyPdfPaths();
  copyStaticPdfs({ publicDir, distPdfDir });
}

function isDirectExecution() {
  return process.argv[1] === fileURLToPath(import.meta.url);
}

if (isDirectExecution()) {
  main();
}
