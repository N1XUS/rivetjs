// Starter templates in an Nx tree: the same files create-rivet copies (the repository's `templates/`, bundled into
// the create-rivet package), read through create-rivet's own helpers — no starter file is duplicated here.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Tree } from "@nx/devkit";
import { findTemplate, rewriteManifest, templateFiles, templatesRoot, TEMPLATES, type PackageJson, type TemplateId } from "create-rivet";

export { TEMPLATES, type PackageJson, type TemplateId };

/** The folder (`starter-static`, …) of a template id. */
export function starterDir(template: TemplateId): string {
  const found = findTemplate(template);
  if (!found) throw new Error(`Unknown template "${template}" (${TEMPLATES.map((t) => t.id).join(", ")})`);
  return found.dir;
}

/** Writes a starter's files under `root` (package.json rewritten: `name`, `@rivetjs/*` → `range`). Returns the paths written. */
export function writeStarter(tree: Tree, template: TemplateId, root: string, name: string, range: string): string[] {
  const source = join(templatesRoot(), starterDir(template));
  const written: string[] = [];
  for (const file of templateFiles(source)) {
    const target = join(root, file.path);
    if (file.path === "package.json") {
      const pkg = rewriteManifest(JSON.parse(readFileSync(file.source, "utf8")) as PackageJson, name, range);
      tree.write(target, JSON.stringify(pkg, null, 2) + "\n");
    } else {
      tree.write(target, readFileSync(file.source));
    }
    written.push(file.path);
  }
  return written;
}

/** One file of a starter (`serve.js` of `starter-server`, …). */
export function starterFile(template: TemplateId, path: string): Buffer {
  return readFileSync(join(templatesRoot(), starterDir(template), path));
}
