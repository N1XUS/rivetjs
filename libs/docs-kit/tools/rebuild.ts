// One `serve` rebuild, run in a fresh child process (`runRebuild`) so it sees the current sources of
// every tool it imports (Vite plugins, the compiler wasm, docs-kit tools, nav modules) and leaves no
// module state behind. Everything is written to a staging dir (`<dist>/.next/`): `serve` swaps it in
// once the whole rebuild succeeded, so a failed rebuild leaves the served build untouched.
import { fork } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadApp } from "./app.ts";
import { writeAtomic } from "./lock.ts";
import type { Plan } from "./watch.ts";

/** Staging dir of a rebuild, inside the app's dist. */
export const STAGING = ".next";
/**
 * Generated files written since the served build (app-relative): a failed rebuild already rewrote
 * them, so the next one would see no change. `serve` deletes it after a successful swap.
 */
export const PENDING = ".artifacts/serve-pending.json";

export interface RebuildResult {
  /** A new site build is staged in `<staging>/client` + `<staging>/server`. */
  site: boolean;
  /** What was rebuilt (for the log line). */
  did: string[];
}

export interface RebuildOptions {
  dist: string;
}

/** Content route files → page URL paths; null when a shared generated file changed (every page is affected). */
export function pagesOf(written: readonly string[]): string[] | null {
  const pages: string[] = [];
  for (const file of written) {
    const route = /^src\/routes\/\(docs\)\/(.+)\.tsx$/.exec(file);
    if (!route) return null;
    const path = route[1]!.replace(/(^|\/)index$/, "");
    pages.push(path ? `/${path}/` : "/");
  }
  return pages;
}

/** Run `plan` for the app at `root`, staging into `<dist>/.next/`. */
export async function rebuild(root: string, plan: Plan, options: RebuildOptions & { log?: (message: string) => void }): Promise<RebuildResult> {
  const { repo } = await loadApp(root);
  const log = options.log ?? (() => {});
  const dist = resolve(options.dist);
  const staging = resolve(dist, STAGING);
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });
  const result: RebuildResult = { site: false, did: [] };
  if (plan.api) {
    const { buildApi } = await import("./api.ts");
    const model = await buildApi(root);
    result.did.push(`api (${model.symbols.length} symbols)`);
  }
  if (plan.site !== "none") {
    const { generateContent } = await import("./content/generate.ts");
    const { generateExamples, usage } = await import("./examples.ts");
    const pendingFile = resolve(root, PENDING);
    const before = existsSync(pendingFile) ? (JSON.parse(await readFile(pendingFile, "utf8")) as string[]) : [];
    const { examples, written: generated } = await generateExamples(root);
    const written = [...new Set([...before, ...generated, ...(await generateContent(root)).written])].sort();
    await writeAtomic(pendingFile, JSON.stringify(written) + "\n");
    const client = resolve(dist, "client");
    // An edit inside an example rewrites its frame module and its entry of examples.json (read by the pages at
    // render time): the pages embedding it, its page and its frames re-render. Anything else generated → every page.
    const own = new Set(["src/generated/examples.json", ...plan.examples.map((id) => `src/generated/example-frames/${id}.tsx`)]);
    const content = written.filter((file) => !own.has(file));
    let pages: string[] | null = plan.site === "full" || !existsSync(client) ? null : pagesOf(content);
    if (pages && plan.examples.length) {
      const used = await usage(root);
      for (const id of plan.examples)
        pages.push(
          ...(used.get(id) ?? []).map((page) => page.href),
          `/examples/${id}/`,
          ...(examples[id]?.pages ?? []).map((path) => `/examples/${id}/frame/${path ? path + "/" : ""}`),
        );
      pages = [...new Set(pages)];
    }
    const { buildSite } = await import("./build.ts");
    const report = await buildSite(root, {
      dist: staging,
      log,
      // Titles and nav changes write pages.ts / nav.ts (full path): carried-over pages keep their search entries.
      ...(pages ? { incremental: { previous: client, pages }, search: "reuse" as const } : {}),
      // Example checks run through their cache (`example-checks.ts`): only changed frame pages open in Chromium.
    });
    result.site = true;
    const what =
      report.prerender === "incremental"
        ? `site (${report.rendered} page(s) rendered, rest carried over)`
        : `site (${report.rendered} pages${report.fallback ? `; incremental fallback: ${report.fallback}` : ""})`;
    result.did.push(
      `${what} [${Object.entries(report.timings)
        .map(([phase, s]) => `${phase} ${s} s`)
        .join(", ")}]`,
    );
  }
  log(`staged in ${relative(repo, staging)}`);
  return result;
}

/**
 * Run `plan` in a child process. Resolves with the result, or rejects with the error and the child's
 * last output lines; the child's output is captured, not streamed (one log line per rebuild).
 */
export function runRebuild(root: string, plan: Plan, options: RebuildOptions): Promise<RebuildResult> {
  return new Promise((done, fail) => {
    const child = fork(fileURLToPath(import.meta.url), [], { stdio: ["ignore", "pipe", "pipe", "ipc"], execArgv: process.execArgv });
    // The rebuild dies with `serve` (Ctrl-C, SIGTERM).
    const kill = () => child.kill("SIGTERM");
    process.once("exit", kill);
    child.once("exit", () => process.off("exit", kill));
    const output: string[] = [];
    const keep = (chunk: Buffer) => {
      output.push(...chunk.toString().split("\n").filter(Boolean));
      if (output.length > 200) output.splice(0, output.length - 200);
    };
    child.stdout!.on("data", keep);
    child.stderr!.on("data", keep);
    let settled = false;
    child.on("message", (message: { ok: true; result: RebuildResult } | { ok: false; error: string }) => {
      settled = true;
      if (message.ok) done(message.result);
      else fail(Object.assign(new Error(message.error), { output: output.slice(-40) }));
    });
    child.on("exit", (code) => {
      if (!settled) fail(Object.assign(new Error(`rebuild process exited with code ${code}`), { output: output.slice(-40) }));
    });
    child.send({ root, plan, options });
  });
}

// Child process entry.
if (process.send && process.argv[1] === fileURLToPath(import.meta.url)) {
  // `serve` died without killing us (SIGKILL, crash): stop.
  process.once("disconnect", () => process.exit(1));
  process.once("message", (message: { root: string; plan: Plan; options: RebuildOptions }) => {
    rebuild(message.root, message.plan, { ...message.options, log: (line) => console.log(line) }).then(
      (result) => process.send!({ ok: true, result }, () => process.exit(0)),
      (error: unknown) => process.send!({ ok: false, error: error instanceof Error ? (error.stack ?? error.message) : String(error) }, () => process.exit(1)),
    );
  });
}
