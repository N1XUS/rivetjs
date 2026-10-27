// `@rivetjs/nx:check`: `rivet sync` (routed apps: fresh `.rivet/`) then `rivet-check -p <tsconfig>`.
import type { ExecutorContext } from "@nx/devkit";
import type { ProjectFacts } from "../../utils/detect.ts";
import { projectFacts } from "../../utils/facts.ts";
import { flags, projectRoot, resolverFrom, runSteps, type BinResolver, type Step } from "../run.ts";
import type { CheckExecutorSchema } from "./schema.js";

export type { CheckExecutorSchema } from "./schema.js";

/** `rivet sync` for projects with a Vite config (the router / compiler plugin writes `.rivet/`). */
export function syncStep(root: string, bin: BinResolver): Step {
  return { label: "rivet sync", args: [bin("@rivetjs/router", "rivet"), "sync"], cwd: root };
}

export function checkSteps(options: CheckExecutorSchema, root: string, facts: ProjectFacts | undefined, bin: BinResolver): Step[] {
  const routed = facts?.kind === "app";
  const steps: Step[] = [];
  if (options.sync ?? routed) {
    const step = syncStep(root, bin);
    if (options.format === "json") step.args.push("--json", "--quiet");
    else if (options.quiet) step.args.push("--quiet");
    // Capture successful sync JSON so stdout contains only the check result.
    if (options.format === "json") step.quietSuccess = true;
    steps.push(step);
  }
  const configs = options.tsConfig === undefined ? ["tsconfig.json"] : Array.isArray(options.tsConfig) ? options.tsConfig : [options.tsConfig];
  steps.push({
    label: "rivet-check",
    args: [
      bin("@rivetjs/language-core", "rivet-check"),
      ...configs.flatMap((config) => ["-p", config]),
      ...flags([
        ["--no-types", options.types === false],
        ["--no-manifest", !(options.manifest ?? routed)],
        ["--format", options.format],
        ["--quiet", options.quiet],
        ["--verbose", options.verbose],
      ]),
    ],
    cwd: root,
  });
  return steps;
}

export default async function checkExecutor(options: CheckExecutorSchema, context: ExecutorContext): Promise<{ success: boolean }> {
  const root = projectRoot(context);
  return runSteps(checkSteps(options, root, projectFacts(root), resolverFrom(root)), { verbose: !options.quiet && options.format !== "json" });
}
