import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

// Helper to get directories only (used when --all is requested)
export function getDirectories(source: string) {
  return fs
    .readdirSync(source, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);
}

export interface SectionInfo {
  section: string;
  title: string;
  files: string[];
  basePath: string;
}

interface MenuItem {
  file: string;
  label?: string;
}

/**
 * Given the path to a human's folder and the list of sections from pdf-config,
 * resolve details about each section: its title (if present), which markdown
 * files need processing, and the base path they live under. This duplicates
 * (and factors out) the logic used by the PDF generator.
 */
export function resolveSections(
  dataPath: string,
  sections: string[],
): SectionInfo[] {
  const results: SectionInfo[] = [];

  for (const section of sections) {
    const sectionPath = path.join(dataPath, section);
    const directFilePath = path.join(dataPath, `${section}.md`);

    let filesToProcess: string[] = [];
    let currentBasePath = sectionPath;
    let sectionTitle = "";

    if (
      fs.existsSync(directFilePath) &&
      fs.lstatSync(directFilePath).isFile()
    ) {
      filesToProcess = [`${section}.md`];
      currentBasePath = dataPath;

      // Optional: title from frontmatter
      const fileContent = fs.readFileSync(directFilePath, "utf8");
      const { data } = matter(fileContent);
      sectionTitle = (data.title as string) || section;
    } else if (
      fs.existsSync(sectionPath) &&
      fs.lstatSync(sectionPath).isDirectory()
    ) {
      const indexPath = path.join(sectionPath, "index.md");

      if (fs.existsSync(indexPath)) {
        const indexFile = fs.readFileSync(indexPath, "utf8");
        const { data: indexData } = matter(indexFile);
        sectionTitle = (indexData.title as string) || section;

        if (indexData.menu && Array.isArray(indexData.menu)) {
          const files = indexData.menu
            .map((item: MenuItem) => item.file)
            .filter(Boolean) as string[];
          filesToProcess = files.length > 0 ? files : ["index.md"];
        } else {
          filesToProcess = indexFile.split("\n").filter(Boolean);
        }
      } else {
        filesToProcess = fs
          .readdirSync(sectionPath)
          .filter((file) => file.endsWith(".md") && file !== "index.md");
      }
    }

    results.push({
      section,
      title: sectionTitle,
      files: filesToProcess,
      basePath: currentBasePath,
    });
  }

  return results;
}
