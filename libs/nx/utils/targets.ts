// Targets of a Rivet project: what the inference plugin adds (`plugin.ts`) and what generators write into
// project.json when inference is off (`addPlugin: false`). One definition, so both stay identical.
import type { TargetConfiguration } from "@nx/devkit";
import type { ProjectFacts } from "./detect.ts";
import { deployOutputs, deployScripts } from "./deploy.ts";

/** Target names (plugin options in nx.json: `{ "plugin": "@rivetjs/nx/plugin", "options": { "buildTargetName": "bundle" } }`). */
export interface RivetPluginOptions {
  buildTargetName?: string;
  devTargetName?: string;
  previewTargetName?: string;
  testTargetName?: string;
  checkTargetName?: string;
  typecheckTargetName?: string;
  /** Platform deploy (vercel / cloudflare adapters). */
  deployTargetName?: string;
}

export const DEFAULT_TARGET_NAMES: Required<RivetPluginOptions> = {
  buildTargetName: "build",
  devTargetName: "dev",
  previewTargetName: "preview",
  testTargetName: "test",
  checkTargetName: "check",
  typecheckTargetName: "typecheck",
  deployTargetName: "deploy",
};

export function targetNames(options: RivetPluginOptions | undefined): Required<RivetPluginOptions> {
  const out = { ...DEFAULT_TARGET_NAMES };
  for (const key of Object.keys(out) as (keyof RivetPluginOptions)[]) {
    const value = options?.[key];
    if (typeof value === "string" && value) out[key] = value;
  }
  return out;
}

/** Generated / output folders: never inputs (the build writes `.rivet/`, which would otherwise bust its own cache). */
const NOT_SOURCES = [
  "!{projectRoot}/.rivet/**/*",
  "!{projectRoot}/dist/**/*",
  "!{projectRoot}/coverage/**/*",
  "!{projectRoot}/src/rivet-i18n.d.ts",
  // Platform packaging output / CLI state (`rivetRouter({ adapter })`).
  "!{projectRoot}/.vercel/**/*",
  "!{projectRoot}/.netlify/**/*",
  "!{projectRoot}/.wrangler/**/*",
];
/** Test files are not inputs of build-like targets (Nx `production` convention). */
const NOT_TESTS = ["!{projectRoot}/**/*.test.{ts,tsx}", "!{projectRoot}/**/*.spec.{ts,tsx}", "!{projectRoot}/vitest.config.{ts,mts,js,mjs}"];

const tech = (description: string) => ({ technologies: ["rivet", "vite"], description });

/**
 * The targets of a project. `production`: whether nx.json defines a `production` named input (then build inputs
 * use it, as official plugins do); otherwise `default` minus test files.
 */
export function rivetTargets(facts: ProjectFacts, options?: RivetPluginOptions, { production = false } = {}): Record<string, TargetConfiguration> {
  const names = targetNames(options);
  const source = production ? ["production", "^production"] : ["default", "^default", ...NOT_TESTS];
  const targets: Record<string, TargetConfiguration> = {};
  if (facts.kind !== "lib") {
    const buildOptions: Record<string, unknown> = {};
    if (facts.locales) buildOptions["locales"] = facts.locales;
    targets[names.buildTargetName] = {
      executor: "@rivetjs/nx:build",
      options: buildOptions,
      cache: true,
      dependsOn: ["^build"],
      inputs: [...source, ...NOT_SOURCES],
      outputs: ["{projectRoot}/dist", ...deployOutputs(facts.adapter)],
      metadata: tech(
        facts.static ? "Client + server build, then prerender every page (static mode)" : facts.csr ? "Browser build (csr mode)" : "Client + server build",
      ),
    };
    targets[names.devTargetName] = {
      executor: "@rivetjs/nx:dev",
      continuous: true,
      options: {},
      metadata: tech("Vite dev server (pages resume like production; hot reload)"),
    };
    // Platform adapters: create-rivet's `--deploy` scripts (same commands), run from the project folder.
    const scripts = deployScripts(facts.adapter);
    const platformPreview = scripts["preview"] ?? scripts["start"];
    targets[names.previewTargetName] = platformPreview
      ? {
          executor: "nx:run-commands",
          continuous: true,
          dependsOn: [names.buildTargetName],
          options: { command: platformPreview, cwd: "{projectRoot}" },
          metadata: tech(`Serve the ${facts.adapter} build locally (${platformPreview})`),
        }
      : {
          executor: "@rivetjs/nx:preview",
          continuous: true,
          dependsOn: [names.buildTargetName],
          options: {},
          metadata: tech(facts.serveScript ? "Serve the build with the project's serve.js" : "Serve the build"),
        };
    if (scripts["deploy"])
      targets[names.deployTargetName] = {
        executor: "nx:run-commands",
        dependsOn: [names.buildTargetName],
        options: { command: scripts["deploy"], cwd: "{projectRoot}" },
        metadata: tech(`Deploy the build to ${facts.adapter} (${scripts["deploy"]})`),
      };
  }
  if (facts.test) {
    targets[names.testTargetName] = {
      executor: "@rivetjs/nx:test",
      options: {},
      cache: true,
      inputs: ["default", production ? "^production" : "^default", ...NOT_SOURCES],
      outputs: ["{projectRoot}/coverage"],
      metadata: { technologies: ["rivet", "vitest"], description: "Vitest with rivetTest() (DOM + server targets)" },
    };
  }
  if (facts.tsconfig) {
    const typeInputs = ["default", production ? "^production" : "^default", ...NOT_SOURCES];
    targets[names.checkTargetName] = {
      executor: "@rivetjs/nx:check",
      options: {},
      cache: true,
      inputs: typeInputs,
      outputs: [],
      metadata: tech("Rivet diagnostics (rivet-check: compiler + serializability + route links)"),
    };
    targets[names.typecheckTargetName] = {
      executor: "@rivetjs/nx:typecheck",
      options: {},
      cache: true,
      inputs: typeInputs,
      outputs: [],
      metadata: { technologies: ["rivet", "typescript"], description: "tsc --noEmit (after rivet sync for routed apps)" },
    };
  }
  return targets;
}
