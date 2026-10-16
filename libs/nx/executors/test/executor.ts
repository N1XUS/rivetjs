// `@rivetjs/nx:test`: Vitest from the project folder (its config registers `rivetTest()`).
import type { ExecutorContext } from "@nx/devkit";
import { flags, projectRoot, resolverFrom, runSteps, type BinResolver, type Step } from "../run.ts";
import type { TestExecutorSchema } from "./schema.js";

export type { TestExecutorSchema } from "./schema.js";

export function testStep(options: TestExecutorSchema, root: string, bin: BinResolver): Step {
  return {
    label: options.watch ? "vitest (watch)" : "vitest run",
    args: [
      bin("vitest"),
      ...(options.watch ? [] : ["run"]),
      ...(options.testFiles ?? []),
      ...flags([
        ["--config", options.config],
        ["--coverage", options.coverage],
        ["--maxWorkers", options.maxWorkers],
        ["--passWithNoTests", options.passWithNoTests ?? true],
        ["--update", options.update],
        ["--testNamePattern", options.testNamePattern],
      ]),
      ...(options.project ?? []).flatMap((name) => ["--project", name]),
      ...(options.reporters ?? []).flatMap((name) => ["--reporter", name]),
    ],
    cwd: root,
    env: options.env ?? {},
  };
}

export default async function testExecutor(options: TestExecutorSchema, context: ExecutorContext): Promise<{ success: boolean }> {
  const root = projectRoot(context);
  return runSteps([testStep(options, root, resolverFrom(root))]);
}
