// `@rivetjs/nx:typecheck`: `rivet sync` (routed apps) then `tsc -p <tsconfig> --noEmit`.
import type { ExecutorContext } from "@nx/devkit";
import type { ProjectFacts } from "../../utils/detect.ts";
import { projectFacts } from "../../utils/facts.ts";
import { syncStep } from "../check/executor.ts";
import { projectRoot, resolverFrom, runSteps, type BinResolver, type Step } from "../run.ts";
import type { TypecheckExecutorSchema } from "./schema.js";

export type { TypecheckExecutorSchema } from "./schema.js";

export function typecheckSteps(options: TypecheckExecutorSchema, root: string, facts: ProjectFacts | undefined, bin: BinResolver): Step[] {
  const steps: Step[] = [];
  if (options.sync ?? facts?.kind === "app") steps.push(syncStep(root, bin));
  steps.push({ label: "tsc --noEmit", args: [bin("typescript", "tsc"), "-p", options.tsConfig ?? "tsconfig.json", "--noEmit"], cwd: root });
  return steps;
}

export default async function typecheckExecutor(options: TypecheckExecutorSchema, context: ExecutorContext): Promise<{ success: boolean }> {
  const root = projectRoot(context);
  return runSteps(typecheckSteps(options, root, projectFacts(root), resolverFrom(root)));
}
