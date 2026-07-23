import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import type { HumanManifest, MenuItem, Page } from "./types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const getHuman = async (id: string): Promise<HumanManifest> => {
  // Resolve the path to src/humans/<id>
  // We are in 'src', so we look directly into 'humans'
  const humansDir = path.join(__dirname, "humans");
  const humanDir = path.join(humansDir, id);
  let introFile = path.join(humanDir, "introduction.md");

  try {
    try {
      await fs.access(introFile);
    } catch {
      // Fallback to checking for file without extension
      const fallback = path.join(humanDir, "introduction");
      await fs.access(fallback);
      introFile = fallback;
    }

    const fileContent = await fs.readFile(introFile, "utf-8");
    const { data, content } = matter(fileContent);

    // frontmatter 'skills' may be a comma-separated string or array
    let skills: string[] | undefined;
    if (data.skills) {
      if (Array.isArray(data.skills)) {
        skills = data.skills.map((s) => String(s).trim());
      } else if (typeof data.skills === "string") {
        skills = data.skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }

    return {
      name: data.name as string,
      role: data.role as string,
      skills,
      portfolio: data.portfolio as string | undefined,
      menu: (data.menu as MenuItem[]) || [],
      content: content,
      dir: humanDir,
      file: path.basename(introFile),
    };
  } catch {
    let debugMsg = `\nChecked path: ${introFile}`;
    try {
      await fs.access(humansDir);
      try {
        await fs.access(humanDir);
        const files = await fs.readdir(humanDir);
        debugMsg += `\nDirectory exists. Contents: ${files.join(", ")}`;
      } catch {
        const humans = await fs.readdir(humansDir);
        debugMsg += `\nCandidate directory missing. Available: ${humans.join(", ")}`;
      }
    } catch {
      debugMsg += `\n'humans' directory missing in src.`;
    }
    throw new Error(`Human "${id}" not found.${debugMsg}`);
  }
};

export const getPage = async (baseDir: string, file: string): Promise<Page> => {
  const filePath = path.join(baseDir, file);
  const fileDir = path.dirname(filePath);

  try {
    const fileContent = await fs.readFile(filePath, "utf-8");
    const { data, content } = matter(fileContent);
    return {
      content,
      menu: data.menu as MenuItem[],
      dir: fileDir,
      file,
    };
  } catch {
    throw new Error(`Data tape corrupted. Could not read file: ${filePath}`);
  }
};
