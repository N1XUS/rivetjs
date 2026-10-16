// `nx g @rivetjs/nx:layout blog --project=web [--guard]`: `src/routes/<directory>/_layout.tsx`.
import { fileURLToPath } from "node:url";
import { formatFiles, generateFiles, joinPathFragments, names, type Tree } from "@nx/devkit";
import { routeComponentName, routedApp, routeSegments } from "../../utils/project.ts";
import type { LayoutGeneratorSchema } from "./schema.js";

export type { LayoutGeneratorSchema } from "./schema.js";

const FILES = fileURLToPath(new URL("./files", import.meta.url));

export async function layoutGenerator(tree: Tree, options: LayoutGeneratorSchema): Promise<void> {
  const project = routedApp(tree, options.project, "layout");
  const segments = routeSegments(options.directory ?? "");
  const folder = joinPathFragments(project.routes, ...segments);
  const file = joinPathFragments(folder, "_layout.tsx");
  if (tree.exists(file)) throw new Error(`layout: ${file} already exists`);
  const base = segments.length ? routeComponentName(segments) : "Root";
  generateFiles(tree, FILES, folder, {
    componentName: base + "Layout",
    className: names(base).fileName + "-layout",
    where: segments.length ? `src/routes/${segments.join("/")}` : "the app",
    guard: Boolean(options.guard),
  });
  if (!options.skipFormat) await formatFiles(tree);
}

export default layoutGenerator;
