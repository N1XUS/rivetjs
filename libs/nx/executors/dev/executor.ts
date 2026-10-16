// `@rivetjs/nx:dev` (alias `serve`): the Vite dev server, kept running (continuous target).
import type { ExecutorContext } from "@nx/devkit";
import { flags, projectRoot, resolverFrom, start, type BinResolver, type Step } from "../run.ts";
import type { DevExecutorSchema } from "./schema.js";

export type { DevExecutorSchema } from "./schema.js";

export function devStep(options: DevExecutorSchema, root: string, bin: BinResolver): Step {
  return {
    label: "vite (dev server)",
    args: [
      bin("vite"),
      ...flags([
        ["--config", options.config],
        ["--mode", options.mode],
        ["--port", options.port],
        ["--host", options.host],
        ["--strictPort", options.strictPort],
        ["--open", options.open],
      ]),
    ],
    cwd: root,
    env: options.env ?? {},
  };
}

/** `http://host:port` the server is expected on (Nx shows it; Vite prints the real one). */
export function baseUrl(options: { port?: number; host?: string | boolean }, fallbackPort: number): string {
  const host = typeof options.host === "string" ? options.host : "localhost";
  return `http://${host}:${options.port ?? fallbackPort}`;
}

export default async function* devExecutor(options: DevExecutorSchema, context: ExecutorContext): AsyncGenerator<{ success: boolean; baseUrl?: string }> {
  const root = projectRoot(context);
  const step = devStep(options, root, resolverFrom(root));
  console.log(`> ${step.label}`);
  const { exit } = start(step);
  yield { success: true, baseUrl: baseUrl(options, 5173) };
  return { success: (await exit) === 0 };
}
