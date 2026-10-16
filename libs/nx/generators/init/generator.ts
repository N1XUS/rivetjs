// `nx g @rivetjs/nx:init`: workspace setup shared by every other generator (idempotent).
import { addDependenciesToPackageJson, formatFiles, readNxJson, updateNxJson, type GeneratorCallback, type Tree } from "@nx/devkit";
import { rivetRange, toolVersion } from "../../utils/versions.ts";
import { ensureLines, shouldAddPlugin } from "../../utils/workspace.ts";
import type { InitGeneratorSchema } from "./schema.js";

export type { InitGeneratorSchema } from "./schema.js";

export const PLUGIN = "@rivetjs/nx/plugin";

/** Adds `@rivetjs/nx/plugin` to nx.json `plugins` (unless it is already there, as a string or `{ plugin }`). */
export function registerPlugin(tree: Tree): void {
  const nxJson = readNxJson(tree) ?? {};
  const plugins = nxJson.plugins ?? [];
  if (plugins.some((entry) => (typeof entry === "string" ? entry : entry.plugin) === PLUGIN)) return;
  plugins.push({
    plugin: PLUGIN,
    options: {
      buildTargetName: "build",
      devTargetName: "dev",
      previewTargetName: "preview",
      testTargetName: "test",
      checkTargetName: "check",
      typecheckTargetName: "typecheck",
    },
  });
  nxJson.plugins = plugins;
  updateNxJson(tree, nxJson);
}

export async function initGenerator(tree: Tree, options: InitGeneratorSchema = {}): Promise<GeneratorCallback> {
  if (shouldAddPlugin(tree, options.addPlugin)) registerPlugin(tree);
  ensureLines(tree, ".gitignore", [".rivet", "dist"]);
  let install: GeneratorCallback = () => {};
  if (!options.skipPackageJson) {
    const rivet = rivetRange(options.rivetVersion);
    install = addDependenciesToPackageJson(
      tree,
      {},
      {
        "@rivetjs/nx": rivet,
        "@rivetjs/compiler": rivet,
        "@rivetjs/language-core": rivet,
        "@rivetjs/typescript-plugin": rivet,
        vite: toolVersion("vite"),
        typescript: toolVersion("typescript"),
        "@types/node": toolVersion("@types/node"),
      },
      undefined,
      options.keepExistingVersions,
    );
  }
  if (!options.skipFormat) await formatFiles(tree);
  // The callback installs the added packages (`installPackagesTask`), after the files are on disk.
  return options.skipInstall ? () => {} : install;
}

export default initGenerator;
