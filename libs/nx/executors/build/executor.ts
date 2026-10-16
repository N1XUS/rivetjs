// `@rivetjs/nx:build`: `vite build` (per locale with i18n) → `vite build --ssr` → prerender (static apps). The same
// steps as the starter templates' `build` script, run from the project folder.
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ExecutorContext } from "@nx/devkit";
import type { ProjectFacts } from "../../utils/detect.ts";
import { projectFacts } from "../../utils/facts.ts";
import { flags, projectRoot, resolverFrom, runSteps, type BinResolver, type Step } from "../run.ts";
import type { BuildExecutorSchema } from "./schema.js";

export type { BuildExecutorSchema } from "./schema.js";

/** Node code of the default prerender step (projects without their own `prerender.js`). */
export function prerenderCode(dist: string): string {
  return (
    `import { prerenderBuild } from "@rivetjs/router/static";\n` +
    `const report = await prerenderBuild({ dist: ${JSON.stringify(dist)} });\n` +
    `console.log("Prerendered " + report.pages.length + " page(s) into " + ${JSON.stringify(dist + "/client")});\n`
  );
}

/** The build steps for a project (pure: `facts` and `bin` are passed in). */
export function buildSteps(options: BuildExecutorSchema, root: string, facts: ProjectFacts | undefined, bin: BinResolver): Step[] {
  const vite = bin("vite");
  const dist = options.outputPath ?? "dist";
  const common = flags([
    ["--config", options.config],
    ["--mode", options.mode],
    ["--logLevel", options.logLevel],
  ]);
  const env = options.env ?? {};
  const steps: Step[] = [];
  const locales = options.locales ?? facts?.locales;
  if (locales?.length) {
    for (const locale of locales)
      steps.push({ label: `vite build (client, ${locale})`, args: [vite, "build", ...common], cwd: root, env: { ...env, RIVET_LOCALE: locale } });
  } else {
    steps.push({ label: "vite build (client)", args: [vite, "build", ...common], cwd: root, env });
  }
  const ssr = options.ssr ?? (facts ? facts.kind === "app" && !facts.csr : false);
  if (ssr) steps.push({ label: "vite build --ssr (server)", args: [vite, "build", "--ssr", ...common], cwd: root, env });
  const prerender = options.prerender ?? Boolean(facts?.static);
  if (prerender) {
    if (!ssr) throw new Error("@rivetjs/nx:build: prerender needs the server build (ssr: true)");
    steps.push(
      facts?.prerenderScript && dist === "dist"
        ? { label: "node prerender.js", args: [join(root, "prerender.js")], cwd: root, env }
        : { label: "prerender", args: ["--input-type=module", "-e", prerenderCode(dist)], cwd: root, env },
    );
  }
  return steps;
}

export default async function buildExecutor(options: BuildExecutorSchema, context: ExecutorContext): Promise<{ success: boolean }> {
  const root = projectRoot(context);
  if (options.config && !existsSync(join(root, options.config))) throw new Error(`@rivetjs/nx:build: ${options.config} not found in ${root}`);
  return runSteps(buildSteps(options, root, projectFacts(root), resolverFrom(root)));
}
