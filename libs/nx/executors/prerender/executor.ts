// `@rivetjs/nx:prerender`: `prerenderBuild()` over an existing build (pipelines that split build and prerender;
// the `build` executor already prerenders static apps).
import { join } from "node:path";
import type { ExecutorContext } from "@nx/devkit";
import { prerenderCode } from "../build/executor.ts";
import { projectRoot, runSteps, type Step } from "../run.ts";
import type { PrerenderExecutorSchema } from "./schema.js";

export type { PrerenderExecutorSchema } from "./schema.js";

export function prerenderStep(options: PrerenderExecutorSchema, root: string): Step {
  if (options.script) return { label: `node ${options.script}`, args: [join(root, options.script)], cwd: root };
  return { label: "prerender", args: ["--input-type=module", "-e", prerenderCode(options.outputPath ?? "dist")], cwd: root };
}

export default async function prerenderExecutor(options: PrerenderExecutorSchema, context: ExecutorContext): Promise<{ success: boolean }> {
  return runSteps([prerenderStep(options, projectRoot(context))]);
}
