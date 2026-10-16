// `nx g @rivetjs/nx:component UserCard --project=web [--kind=overlay] [--story] [--no-test]`.
import { fileURLToPath } from "node:url";
import { formatFiles, generateFiles, joinPathFragments, names, type Tree } from "@nx/devkit";
import { relativeImport, rivetProject } from "../../utils/project.ts";
import type { ComponentGeneratorSchema } from "./schema.js";

export type { ComponentGeneratorSchema } from "./schema.js";

const FILES = fileURLToPath(new URL("./files", import.meta.url));

export async function componentGenerator(tree: Tree, options: ComponentGeneratorSchema): Promise<void> {
  const project = rivetProject(tree, options.project);
  const { className } = names(options.name);
  if (!/^[A-Z][A-Za-z0-9]*$/.test(className)) throw new Error(`component: "${options.name}" is not a valid component name`);
  const kind = options.kind ?? "basic";
  const directory = (options.directory ?? (project.library ? "" : "components")).replace(/^\/+|\/+$/g, "");
  const folder = joinPathFragments(project.src, directory);
  const file = joinPathFragments(folder, `${className}.tsx`);
  if (tree.exists(file)) throw new Error(`component: ${file} already exists`);
  // The file keeps the component name (`UserCard.tsx`); the markup class is kebab-case (`user-card`).
  const vars = { className, fileName: className, cssName: names(className).fileName, overlay: kind === "overlay" };
  generateFiles(tree, joinPathFragments(FILES, kind), folder, vars);
  if (options.test ?? Boolean(project.facts?.test)) generateFiles(tree, joinPathFragments(FILES, `test-${kind}`), folder, vars);
  if (options.story) {
    if (project.facts?.kind !== "app") throw new Error("component: --story needs a Rivet app with file routes");
    const stories = joinPathFragments(project.routes, "stories");
    const storyName = names(className).fileName;
    generateFiles(tree, joinPathFragments(FILES, "story"), stories, {
      ...vars,
      storyName,
      url: `/stories/${storyName}`,
      importPath: relativeImport(stories, file),
    });
  }
  if (options.export ?? project.library) {
    const index = joinPathFragments(project.src, "index.ts");
    const from = relativeImport(project.src, file);
    const line = `export { ${className}, type ${className}Props } from "${from}";\n`;
    const text = tree.exists(index) ? tree.read(index, "utf8")! : "";
    if (!text.includes(line)) tree.write(index, (text && !text.endsWith("\n") ? text + "\n" : text) + line);
  }
  if (!options.skipFormat) await formatFiles(tree);
}

export default componentGenerator;
