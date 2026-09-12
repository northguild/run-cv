import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { marked } from "marked";
import meow from "meow";
import playwright from "playwright-core";

// 1. Setup paths
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STYLES_DIR = path.resolve(__dirname, "styles");
const THEMES_DIR = path.join(STYLES_DIR, "themes");
const HUMANS_DIR = path.resolve(__dirname, "../../src/humans");

const cli = meow(
  `
    Usage
      $ npm run gen-pdf <name>

    Options
      --theme, -t  Specify a theme (e.g., terminal, vintage)
      --all        Generate PDFs for all humans and all themes
  `,
  {
    importMeta: import.meta,
    flags: {
      theme: {
        type: "string",
        shortFlag: "t",
        default: "vintage",
      },
      all: { type: "boolean", default: false },
    },
  },
);

// Helper to get directories only
const getDirectories = (source: string) =>
  fs
    .readdirSync(source, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

async function main() {
  const [nameInput] = cli.input;
  const { theme: themeInput, all } = cli.flags;

  const browser = await playwright.chromium.launch({ headless: true });
  const tasks: { name: string; theme: string }[] = [];

  if (all) {
    console.log(
      "\x1b[36m%s\x1b[0m",
      "🚀 Starting Bulk Build: All Humans, All Themes",
    );
    const humans = getDirectories(HUMANS_DIR);
    const themes = getDirectories(THEMES_DIR);

    for (const h of humans) {
      for (const t of themes) {
        tasks.push({ name: h, theme: t });
      }
    }
  } else if (nameInput) {
    tasks.push({ name: nameInput.toLowerCase(), theme: themeInput });
  } else {
    cli.showHelp();
    await browser.close();
    return;
  }

  // Process queue
  for (const task of tasks) {
    const userPath = path.join(HUMANS_DIR, task.name);
    if (!fs.existsSync(userPath)) {
      console.warn(
        `\x1b[33m⚠ Skipping: Human "${task.name}" not found.\x1b[0m`,
      );
      continue;
    }

    try {
      await generatePDF(task.name, userPath, task.theme, browser);
    } catch (error) {
      console.error(
        `\x1b[31m✖ Failed ${task.name} [${task.theme}]:\x1b[0m`,
        error,
      );
    }
  }

  await browser.close();
  console.log("\x1b[32m%s\x1b[0m", "✔ All PDF tasks completed.");
}

async function generatePDF(
  name: string,
  dataPath: string,
  theme: string,
  browser: playwright.Browser,
) {
  // 1. Setup Theme Data
  const themeDir = path.join(THEMES_DIR, theme);
  const themeVariables = fs.readFileSync(
    path.join(themeDir, "variables.css"),
    "utf8",
  );
  const themeCss = fs.readFileSync(path.join(themeDir, "base.css"), "utf8");
  const themePdfCss = fs.readFileSync(
    path.join(themeDir, "header-footer.css"),
    "utf8",
  );
  const rootCss = fs.readFileSync(path.join(STYLES_DIR, "root.css"), "utf8");

  // 2. Parse Markdown (your existing logic)
  const configPath = path.join(dataPath, "pdf-config.md");
  const { data: config } = matter(fs.readFileSync(configPath, "utf8"));

  let htmlContent = "";

  for (const section of config.sections as string[]) {
    const sectionPath = path.join(dataPath, section);
    const directFilePath = path.join(dataPath, `${section}.md`);

    let filesToProcess: string[] = [];
    let currentBasePath = sectionPath;
    let sectionTitle = ""; // Initialize title variable

    if (
      fs.existsSync(directFilePath) &&
      fs.lstatSync(directFilePath).isFile()
    ) {
      filesToProcess = [`${section}.md`];
      currentBasePath = dataPath;

      // Optional: Extract title from the standalone file's matter
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

        // CAPTURE THE TITLE HERE
        sectionTitle = (indexData.title as string) || section;

        if (indexData.menu && Array.isArray(indexData.menu)) {
          filesToProcess = indexData.menu
            .map((item: { file?: string }) => item.file)
            .filter(Boolean) as string[];
          if (filesToProcess.length === 0) {
            filesToProcess = ["index.md"];
          }
        } else {
          filesToProcess = indexFile.split("\n").filter(Boolean);
        }
      } else {
        filesToProcess = fs
          .readdirSync(sectionPath)
          .filter((file) => file.endsWith(".md") && file !== "index.md");
      }
    }

    // PREPEND THE TITLE TO THE HTML CONTENT
    if (sectionTitle) {
      htmlContent += `<h2 class="section-title title-${section}">${sectionTitle}</h2>`;
    }

    for (const file of filesToProcess) {
      const filePath = path.join(currentBasePath, file.trim());
      if (fs.existsSync(filePath)) {
        const markdown = fs.readFileSync(filePath, "utf8");
        const { data, content } = matter(markdown);
        let processed = content;

        // If this is the introduction page and skills are defined, replace
        // the placeholder comment with a horizontal badge list.
        if (
          section === "introduction" &&
          data.skills &&
          processed.includes("<!-- Skills badges -->")
        ) {
          const skillsArray: string[] = Array.isArray(data.skills)
            ? data.skills
            : String(data.skills)
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);

          const badges = skillsArray
            .map((s) => `<span class="skill">${s}</span>`)
            .join(" ");

          processed = processed.replace(
            "<!-- Skills badges -->",
            `<div class="skills-container">${badges}</div>`,
          );
        }

        // Wrap in a section for CSS targeting
        htmlContent += `<section class="cv-section section-${section}">
          ${marked(processed)}
        </section>`;
      }
    }
  }

  const fullHtml = `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8">
      <style>
        ${rootCss}
        ${themeVariables}
        ${themeCss}
      </style>
    </head>
    <body>
      <main>${htmlContent}</main>
    </body>
  </html>`;

  // Use the existing browser instance
  const page = await browser.newPage();
  await page.setContent(fullHtml, { waitUntil: "networkidle" });

  // public/ is the tracked source of truth for every PDF: `copy:pdfs` fans
  // them out to dist/pdf/ for the npm tarball, and the web build copies them
  // into each human's payload directory. Generation needs a browser, so the
  // outputs are committed rather than rebuilt in CI.
  const pdfPath = path.resolve(
    __dirname,
    `../../public/${name}-${theme}-cv.pdf`,
  );
  fs.mkdirSync(path.dirname(pdfPath), { recursive: true });

  const baseTemplateStyle = `
    <style>
        ${themeVariables}
        html, body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; width: 100%; }
        #header, #footer { padding: 0; margin: 0; width: 100%; }
        .container {
            width: 100%; display: flex; align-items: center; font-size: 9pt;
            font-family: monospace; padding: 5mm 10mm; box-sizing: border-box; height: 10mm;
        }
        ${themePdfCss}
    </style>`;

  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: `${baseTemplateStyle}<div class="container header-area">${config.header}</div>`,
    footerTemplate: `${baseTemplateStyle}
      <div class="container footer-area">
        <span>${config.footer}</span>
        <span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>
      </div>`,
    margin: { top: "25mm", bottom: "20mm", left: "0px", right: "0px" },
  });

  await page.close(); // Important: Close the tab, but keep the browser open
  console.log(`\x1b[32m  ✔ Generated: ${name}-${theme}.pdf\x1b[0m`);
}

main();
