// `@rivetjs/nx:preview`: serves the build (continuous target, depends on `build`). The project's own `serve.js`
// wins (starters ship one); a routed app without it runs `start()` of `@rivetjs/router/node`; anything else
// gets `vite preview`.
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ExecutorContext } from "@nx/devkit";
import type { ProjectFacts } from "../../utils/detect.ts";
import { projectFacts } from "../../utils/facts.ts";
import { baseUrl } from "../dev/executor.ts";
import { flags, projectRoot, resolverFrom, start, type BinResolver, type Step } from "../run.ts";
import type { PreviewExecutorSchema } from "./schema.js";

export type { PreviewExecutorSchema } from "./schema.js";

/** Node code of the router's production server over `dist`. */
export function startCode(dist: string): string {
  return (
    `import { closeOnSignals, start } from "@rivetjs/router/node";\n` +
    `const serving = await start({ dist: ${JSON.stringify(dist)}, port: Number(process.env.PORT ?? 3000), host: process.env.HOST ?? "127.0.0.1" });\n` +
    `closeOnSignals(serving);\n` +
    `console.log("Listening on " + serving.url);\n`
  );
}

export function previewStep(options: PreviewExecutorSchema, root: string, facts: ProjectFacts | undefined, bin: BinResolver, serverBuilt: boolean): Step {
  const dist = options.outputPath ?? "dist";
  const env: Record<string, string> = { ...options.env };
  if (options.port !== undefined) env["PORT"] = String(options.port);
  if (options.host !== undefined) env["HOST"] = options.host;
  if (facts?.serveScript && dist === "dist") return { label: "node serve.js", args: [join(root, "serve.js")], cwd: root, env };
  if (facts?.kind === "app" && serverBuilt) return { label: "router node server", args: ["--input-type=module", "-e", startCode(dist)], cwd: root, env };
  return {
    label: "vite preview",
    args: [
      bin("vite"),
      "preview",
      ...flags([
        ["--port", options.port],
        ["--host", options.host],
        ["--outDir", facts?.kind === "app" ? `${dist}/client` : undefined],
      ]),
    ],
    cwd: root,
    env: options.env ?? {},
  };
}

export default async function* previewExecutor(
  options: PreviewExecutorSchema,
  context: ExecutorContext,
): AsyncGenerator<{ success: boolean; baseUrl?: string }> {
  const root = projectRoot(context);
  const dist = options.outputPath ?? "dist";
  const facts = projectFacts(root);
  const step = previewStep(options, root, facts, resolverFrom(root), existsSync(join(root, dist, "server")));
  console.log(`> ${step.label}`);
  const { exit } = start(step);
  // Starter defaults: static serve.js and vite preview 4173, server serve.js and the router server 3000.
  yield { success: true, baseUrl: baseUrl(options, step.label === "vite preview" || facts?.static ? 4173 : 3000) };
  return { success: (await exit) === 0 };
}
