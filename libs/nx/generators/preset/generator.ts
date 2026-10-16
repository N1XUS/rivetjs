// `npx create-nx-workspace <name> --preset=@rivetjs/nx [--template=…]`: init + the first app, package-based
// layout (npm / yarn / bun `workspaces: ["apps/*", "libs/*"]` unless the workspace already has a list).
import { formatFiles, readJson, updateJson, type GeneratorCallback, type Tree } from "@nx/devkit";
import { applicationGenerator } from "../application/generator.ts";
import { initGenerator } from "../init/generator.ts";
import type { PresetGeneratorSchema } from "./schema.js";

export type { PresetGeneratorSchema } from "./schema.js";

export async function presetGenerator(tree: Tree, options: PresetGeneratorSchema): Promise<GeneratorCallback> {
  const appName = options.appName ?? options.name;
  if (tree.exists("package.json") && !tree.exists("pnpm-workspace.yaml") && !readJson<{ workspaces?: unknown }>(tree, "package.json").workspaces) {
    updateJson(tree, "package.json", (pkg: Record<string, unknown>) => ({ ...pkg, workspaces: ["apps/*", "libs/*"] }));
  }
  const rivet = options.rivetVersion ? { rivetVersion: options.rivetVersion } : {};
  await initGenerator(tree, { skipFormat: true, skipInstall: true, ...rivet });
  const install = await applicationGenerator(tree, {
    directory: options.directory ?? `apps/${appName}`,
    name: appName,
    ...(options.template ? { template: options.template } : {}),
    ...(options.adapter ? { adapter: options.adapter } : {}),
    ...(options.deploy ? { deploy: options.deploy } : {}),
    ...(options.tailwind !== undefined ? { tailwind: options.tailwind } : {}),
    ...(options.unitTestRunner ? { unitTestRunner: options.unitTestRunner } : {}),
    ...rivet,
    skipFormat: true,
    ...(options.skipInstall ? { skipInstall: true } : {}),
  });
  if (!options.skipFormat) await formatFiles(tree);
  return install;
}

export default presetGenerator;
