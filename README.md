# run-cv

A mainframe-inspired terminal CV viewer built with Node.js, React, and Ink.

![Terminal UI](https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3R5eXJ5eXJ5eXJ5eXJ5eXJ5eXJ5eXJ5eXJ5eXJ5eXJ5eXJ5eSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7TKSjRrfIPjeiVyM/giphy.gif)

## Features

- 📟 **Retro Terminal UI**: Green-screen aesthetic with keyboard navigation.
- 📝 **Markdown Driven**: CV content is managed entirely via Markdown files.
- 📂 **Multi-Human Support**: Easily switch between different profiles.

## Usage

- 📟 MacOS/Linux: Just run npx run-cv <name>
- 🪟 Windows: Ensure Node.js is installed, then run npx run-cv <name> in your terminal.

```bash
npx run-cv <name>
```

## Development

To run the project locally:

```bash
pnpm install
pnpm run dev
# or for a specific profile
pnpm run dev <name>
```

### Usage

To run the CV for a specific human:

```bash
pnpm run dev <name>
```

## Adding a New Human

1. Create a folder in `src/humans/<name>`.
2. Create an `introduction.md` file. This acts as the manifest and entry point. (PDF generator now reads from this file; `pdf-intro.md` is deprecated.)
   - Frontmatter may include a `skills:` field (comma-separated) and you can place
     `<!-- Skills badges -->` somewhere in the body to have them rendered as
     retro badges in the terminal and as styled labels above the intro text in
     the PDF.

```markdown
---
name: Your Name
role: Your Role
menu:
  - label: Work Experience
    file: experience/index.md
  - label: Contact
    file: contact.md
---

# SYSTEM ONLINE

Welcome to the terminal.
```

3. Add the referenced markdown files (e.g., `experience.md`, `contact.md`) in the same folder.

## PDF Generation

You can generate a PDF version of a CV using the `gen-pdf` script. It will include the text from `introduction.md` at the top; separate `pdf-intro.md` files are no longer required.

```bash
pnpm run gen-pdf <name> [-- --theme <theme-name>]
```

- `<name>`: The name of the human.
- `--theme <theme-name>`: (Optional) Specify a theme. Defaults to `vintage`.

A companion utility, `gen-json`, will export the same CV content as a
plain JSON file (frontmatter plus markdown body). It ignores any UI/menu
fields so you can consume it from other tools.

```bash
pnpm run gen-json <name> [-- --all]
```

Available themes:

- `vintage`
- `terminal`

Each theme supports a handful of CSS variables you can tweak in
`styles/themes/<theme>/base.css`. A new variable `--list-item-spacing` controls
vertical distance between `<li>` elements (default 1 mm), so PDFs render
without excessive gaps.

**Example:**

```bash
# Generate a PDF for <name> with the 'terminal' theme
  pnpm run gen-pdf <name> -- --theme terminal
```

## NPM Publishing & Versioning Guide

We use **Semantic Versioning (SemVer)** to manage releases. Instead of manually editing `package.json`, use the following automated workflow to ensure the repository tags and the NPM registry remain perfectly in sync.

### 1. Semantic Versioning Commands

Decide which part of the version number ($X.Y.Z$) to increment based on your changes:

| Command             | Result              | Use Case                                                              |
| :------------------ | :------------------ | :-------------------------------------------------------------------- |
| `pnpm version patch` | `0.0.x` → `0.0.x+1` | Bug fixes, style tweaks, or minor text updates.                       |
| `pnpm version minor` | `0.x.0` → `0.x+1.0` | New features (e.g., a new PDF theme) that are backward-compatible.    |
| `pnpm version major` | `x.0.0` → `x+1.0.0` | Breaking changes (e.g., changing the data tape structure or CLI API). |

> **Note:** These commands automatically update `package.json` and `pnpm-lock.yaml`, create a git commit, and generate a git tag.

Example:

```bash
pnpm version patch -m "Release v%s: Fixed header spacing and updated blah theme"
```

### 2. Sync to GitHub (with tags)

git push origin main --follow-tags

### 3. Publish to npm

```bash
pnpm login
pnpm publish
```

### 5. Finalize GitHub Release

Go to the Releases tab on GitHub.

Click Draft a new release.

Select the Tag you just pushed (e.g., v0.0.6).

Click Generate release notes to automatically pull in your commit history.

Click Publish release
