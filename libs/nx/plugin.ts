// Inferred tasks (Nx project crystal): `{ "plugins": [{ "plugin": "@rivetjs/nx/plugin", "options": { … } }] }` in nx.json.
// Every folder with a Rivet Vite config (`rivetRouter()` / `@rivetjs/compiler/vite`) or a Rivet Vitest config
// (`rivetTest()`) next to a package.json / project.json becomes a project with build / dev / preview / test / check /
// typecheck targets (`utils/targets.ts`). Configs are read as text, never executed.
import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { createNodesFromFiles, type CreateNodes, type CreateNodesContext, type CreateNodesResult } from "@nx/devkit";
import { VITE_CONFIGS } from "./utils/detect.ts";
import { projectFacts } from "./utils/facts.ts";
import { rivetTargets, type RivetPluginOptions } from "./utils/targets.ts";

export type { RivetPluginOptions } from "./utils/targets.ts";

/** Vite and Vitest config files (one project per folder; a vitest config defers to a sibling vite config). */
export const CONFIG_GLOB = "**/{vite,vitest}.config.{ts,mts,js,mjs}";

/** The inferred project of one config file (`file` workspace-relative); `{}` when it is not a Rivet project. */
export function createRivetProject(file: string, options: RivetPluginOptions | undefined, context: CreateNodesContext): CreateNodesResult {
  const root = dirname(file);
  const abs = join(context.workspaceRoot, root);
  if (!existsSync(join(abs, "package.json")) && !existsSync(join(abs, "project.json"))) return {};
  // One result per folder: a vitest config with a sibling vite config is read through the vite config's result.
  if (basename(file).startsWith("vitest.") && VITE_CONFIGS.some((name) => existsSync(join(abs, name)))) return {};
  const facts = projectFacts(abs);
  if (!facts) return {};
  const production = Boolean(context.nxJsonConfiguration.namedInputs?.["production"]);
  return {
    projects: {
      [root]: {
        root,
        ...(facts.kind === "lib" ? {} : { projectType: "application" as const }),
        targets: rivetTargets(facts, options, { production }),
        metadata: { technologies: ["rivet"] },
      },
    },
  };
}

/** Nx 23 plugin API (`createNodes` with the v2 signature). */
export const createNodes: CreateNodes<RivetPluginOptions> = [
  CONFIG_GLOB,
  (files, options, context) => createNodesFromFiles((file, opts, ctx) => createRivetProject(file, opts, ctx), files, options ?? {}, context),
];

/** Same as {@link createNodes}: the name older Nx releases (20–22) look for. */
export const createNodesV2: CreateNodes<RivetPluginOptions> = createNodes;

export const name = "@rivetjs/nx";
