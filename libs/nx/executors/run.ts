// Shared executor plumbing: resolve a tool's bin from the project folder (the project's own install wins, then the
// workspace's, like `npm run`), run steps as child processes (`node <bin> …`, so no shell and no PATH lookup), and
// stream their output. Executors normalise their options into `Step[]` with pure functions (unit-tested).
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { ExecutorContext } from "@nx/devkit";

/** One child process: `node <args…>` in `cwd`. */
export interface Step {
  /** Shown before the step runs. */
  label: string;
  /** Buffer stdout and replay it only on failure (JSON prerequisite steps). */
  quietSuccess?: boolean;
  /** Arguments after the Node binary (`[bin, …args]` or `["--input-type=module", "-e", code]`). */
  args: string[];
  cwd: string;
  env?: Record<string, string>;
}

/** The project folder (absolute) of the running target. */
export function projectRoot(context: ExecutorContext): string {
  const name = context.projectName;
  const project = name ? context.projectsConfigurations?.projects[name] : undefined;
  if (!project) throw new Error(`@rivetjs/nx: no project for ${name ?? "(unknown)"}`);
  return resolve(context.root, project.root);
}

/** The package folder of `pkg` as Node would find it from `from` (walks up `node_modules`); real path. */
export function packageDir(pkg: string, from: string): string {
  for (let dir = resolve(from); ; dir = dirname(dir)) {
    const candidate = join(dir, "node_modules", pkg, "package.json");
    if (existsSync(candidate)) return realpathSync(dirname(candidate));
    if (dirname(dir) === dir) throw new Error(`@rivetjs/nx: cannot find ${pkg} from ${from} (install it in the workspace)`);
  }
}

/** Absolute path of a package's bin (`bin` field; `name` picks one of several). */
export function binPath(pkg: string, from: string, name?: string): string {
  const dir = packageDir(pkg, from);
  const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { name: string; bin?: string | Record<string, string> };
  const bin = typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.[name ?? pkg.split("/").pop()!];
  if (!bin) throw new Error(`@rivetjs/nx: ${pkg} has no bin${name ? ` "${name}"` : ""}`);
  return join(dir, bin);
}

/** Tool lookup the normalisers use; tests pass a fake one. */
export type BinResolver = (pkg: string, name?: string) => string;
export const resolverFrom =
  (from: string): BinResolver =>
  (pkg, name) =>
    binPath(pkg, from, name);

/** Command-line flags from an options object (`--port 4510`, `--open`), in a fixed order. */
export function flags(entries: [flag: string, value: string | number | boolean | undefined][]): string[] {
  const out: string[] = [];
  for (const [flag, value] of entries) {
    if (value === undefined || value === false) continue;
    out.push(flag);
    if (value !== true) out.push(String(value));
  }
  return out;
}

/** Children started by this process (killed when it gets SIGINT / SIGTERM, so continuous targets stop cleanly). */
const children = new Set<ChildProcess>();
let hooked = false;
function hookSignals() {
  if (hooked) return;
  hooked = true;
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      for (const child of children) child.kill(signal);
      process.exit(130);
    });
  }
}

/** Starts a step; `exit` resolves with its status (signals count as failure). */
export function start(step: Step): { child: ChildProcess; exit: Promise<number> } {
  hookSignals();
  const child = spawn(process.execPath, step.args, {
    cwd: step.cwd,
    env: { ...process.env, ...step.env },
    stdio: step.quietSuccess ? ["inherit", "pipe", "inherit"] : "inherit",
  });
  children.add(child);
  const output: Buffer[] = [];
  if (step.quietSuccess) child.stdout?.on("data", (chunk: Buffer) => output.push(chunk));
  const exit = new Promise<number>((done) => {
    child.on("error", (error) => {
      children.delete(child);
      console.error(
        `[rivet:nx] error: ${step.label} could not start in ${step.cwd}: ${error.message}\n  fix: Check the working directory and tool installation.${process.env.DEBUG === "rivet" ? "\n" + error.stack : ""}`,
      );
      done(1);
    });
    child.on("close", (code) => {
      if (step.quietSuccess && code !== 0) for (const chunk of output) process.stdout.write(chunk);
      children.delete(child);
      done(code ?? 1);
    });
  });
  return { child, exit };
}

/** Runs steps in order; stops at the first failure. */
export async function runSteps(steps: Step[], { verbose = true } = {}): Promise<{ success: boolean }> {
  for (const step of steps) {
    const started = performance.now();
    if (verbose) console.error(`[rivet:nx] ${step.label} (${step.cwd})`);
    const status = await start(step).exit;
    if (status !== 0) {
      if (verbose) console.error(`[rivet:nx] error: ${step.label} exited ${status}. Fix the diagnostic above and rerun the target.`);
      return { success: false };
    }
    if (verbose) console.error(`[rivet:nx] ${step.label} finished in ${((performance.now() - started) / 1000).toFixed(1)} s`);
  }
  return { success: true };
}
