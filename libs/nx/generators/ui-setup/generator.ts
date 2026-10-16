// `nx g @rivetjs/nx:ui-setup web`: @rivetjs/ui on an existing app, the way the `ui` starter
// sets it up (Tailwind v4 plugin, `@import "tailwindcss"; @import "@rivetjs/ui/styles";`, ui + kit + lucide). Idempotent.
import {
  addDependenciesToPackageJson,
  formatFiles,
  installPackagesTask,
  joinPathFragments,
  readJson,
  writeJson,
  type GeneratorCallback,
  type Tree,
} from "@nx/devkit";
import { viteConfigPath } from "../../utils/facts.ts";
import { routedApp } from "../../utils/project.ts";
import { rivetRange, starterVersions, toolVersion } from "../../utils/versions.ts";
import { addImport, addPlugin, setRouterOption } from "../../utils/vite-config.ts";
import { isWorkspacePackage } from "../../utils/workspace.ts";
import type { UiSetupGeneratorSchema } from "./schema.js";

export type { UiSetupGeneratorSchema } from "./schema.js";

/** `src/styles.css` with Tailwind first, then the ui styles (a `@import` must precede other rules). */
export function uiStyles(css: string): string {
  const ui = '@import "@rivetjs/ui/styles";';
  if (css.includes("@rivetjs/ui/styles")) return css;
  const lines = css.split("\n");
  const tailwind = lines.findIndex((line) => /@import\s+["']tailwindcss["']/.test(line));
  if (tailwind >= 0) {
    lines.splice(tailwind + 1, 0, ui);
    return lines.join("\n");
  }
  return `@import "tailwindcss";\n${ui}\n/* Scan the app's source for class names (explicit, so it also works in ignored folders). */\n@source "./**/*.{ts,tsx}";\n\n${css}`;
}

export async function uiSetupGenerator(tree: Tree, options: UiSetupGeneratorSchema): Promise<GeneratorCallback> {
  const project = routedApp(tree, options.project, "ui-setup");
  const vite = viteConfigPath(tree, project.root)!;
  let config = tree.read(vite, "utf8")!;
  config = addImport(config, 'import tailwindcss from "@tailwindcss/vite";');
  config = addPlugin(config, "tailwindcss()", "last");
  if (!/\bstyles\s*:/.test(config)) config = setRouterOption(config, "styles", '["src/styles.css"]');
  tree.write(vite, config);
  const styles = joinPathFragments(project.src, "styles.css");
  tree.write(styles, uiStyles(tree.exists(styles) ? tree.read(styles, "utf8")! : ""));

  let install: GeneratorCallback = () => {};
  if (!options.skipPackageJson) {
    const rivet = rivetRange(options.rivetVersion);
    const ui = starterVersions("starter-ui");
    const deps = { "@rivetjs/ui": rivet, "@rivetjs/kit": rivet, lucide: ui["lucide"] ?? toolVersion("lucide") };
    const devDeps = { tailwindcss: toolVersion("tailwindcss"), "@tailwindcss/vite": toolVersion("@tailwindcss/vite") };
    const pkgPath = joinPathFragments(project.root, "package.json");
    if (tree.exists(pkgPath)) {
      const pkg = readJson<{ dependencies?: Record<string, string>; devDependencies?: Record<string, string> }>(tree, pkgPath);
      pkg.dependencies = { ...pkg.dependencies, ...deps };
      pkg.devDependencies = { ...pkg.devDependencies, ...devDeps };
      writeJson(tree, pkgPath, pkg);
    }
    const workspacePackage = tree.exists(pkgPath) && isWorkspacePackage(tree, project.root);
    if (!workspacePackage) addDependenciesToPackageJson(tree, deps, devDeps);
    install = () => installPackagesTask(tree, workspacePackage);
  }
  if (!options.skipFormat) await formatFiles(tree);
  return install;
}

export default uiSetupGenerator;
