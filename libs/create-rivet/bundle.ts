// Package-time step (`publishConfig.bundle`, run by scripts/package/build.ts with the package's output folder):
// copies the repository's `templates/<starter>` folders the CLI offers (+ `templates/_<overlay>` folders) into `<out>/templates`, so the published
// package carries them (single source of truth: the repo's `templates/`). `.gitignore` → `_gitignore`, since npm
// never packs `.gitignore` files; `copyTemplateDir` renames it back when a project is created.
//
//   node libs/create-rivet/bundle.ts <out>
import { cpSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { SKIP, TEMPLATES } from "./index.ts";

const REPO_TEMPLATES = resolve(import.meta.dirname, "../../templates");

/** Copies every offered template into `<out>/templates`; returns the copied paths (relative, posix). */
export function bundleTemplates(out: string, from = REPO_TEMPLATES): string[] {
  const target = join(out, "templates");
  rmSync(target, { recursive: true, force: true });
  const copied: string[] = [];
  // Offered starters + overlay folders (`_<name>`: files layered over a starter, see `Overlay` in index.ts).
  const overlays = readdirSync(from, { withFileTypes: true }).filter((entry) => entry.isDirectory() && entry.name.startsWith("_"));
  for (const dir of [...TEMPLATES.map((template) => template.dir), ...overlays.map((entry) => entry.name)]) {
    const root = join(from, dir);
    const walk = (at: string) => {
      for (const entry of readdirSync(at, { withFileTypes: true })) {
        const path = join(at, entry.name);
        const rel = relative(from, path);
        if (SKIP.test(relative(root, path))) continue;
        if (entry.isDirectory()) walk(path);
        else {
          const to = join(target, dirname(rel), entry.name === ".gitignore" ? "_gitignore" : entry.name);
          mkdirSync(dirname(to), { recursive: true });
          cpSync(path, to);
          copied.push(relative(target, to).split("\\").join("/"));
        }
      }
    };
    walk(root);
  }
  return copied.sort();
}

if (import.meta.main) {
  const out = process.argv[2];
  if (!out) {
    console.error("usage: node libs/create-rivet/bundle.ts <out>");
    process.exit(2);
  }
  console.log(`create-rivet: bundled ${bundleTemplates(resolve(out)).length} template files`);
}
