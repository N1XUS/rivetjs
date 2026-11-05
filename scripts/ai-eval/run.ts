// AI eval runner: grades model-written Rivet code for the tasks in `tasks.ts`. No model API calls: the
// outputs come from files (`<outputs>/<task id>/<app-relative path>`), written by whoever ran the prompts
// (a person with Claude Code + the Rivet MCP server, a batch job, …). `--reference` grades the seeded
// solutions in `reference/` instead (they must pass: `scripts/tests/ai-eval.test.ts`).
//
//   node scripts/ai-eval/run.ts prompts [--out dir]                  write one prompt file per task
//   node scripts/ai-eval/run.ts workspace <task> [--out dir]         a starter copy (with AGENTS.md, skills) to work in
//   node scripts/ai-eval/run.ts collect <task> --from dir --outputs dir   copy the task's files out of a workspace
//   node scripts/ai-eval/run.ts (--outputs dir | --reference) [task …] [--json file] [--keep]
//
// Per task, in order (a failing step skips the rest):
//   files      every file the task names exists in the output; no forbidden pattern (React imports / hooks, SVG paths…);
//              every `require` pattern of the task present
//   rv         Rivet compiler + language service (`check_code` of @rivetjs/mcp) on each output file: no RV errors
//   build      the task's starter (templates/starter-*) + the output files, built like `npm run build`
//   typecheck  `tsc -p` over the staged app
//   behaviour  the built app served (static preview or the Node server), Chromium runs the task's steps
//              (docs-kit example `Step`s + `reload` / `viewport` / `count`); page errors and console errors fail it
//              (not the browser's "Failed to load resource" lines: a 400 from a rejected form is expected)
// Staging: `.artifacts/ai-eval/<task>/` inside the repo (workspace packages resolve from the root `node_modules`).
import { execFileSync, spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { checkCode } from "../../libs/mcp/check.ts";
import { TASKS, type EvalStep, type EvalTask } from "./tasks.ts";

export const REPO = resolve(import.meta.dirname, "../..");
const TEMPLATES = resolve(REPO, "templates");
const STAGE = resolve(REPO, ".artifacts/ai-eval");
const VITE = resolve(REPO, "node_modules/vite/bin/vite.js");
const TSC = resolve(REPO, "node_modules/typescript/bin/tsc");
/** Starter files never staged: generated / installed folders and the AI instruction files. */
const SKIP = /^(node_modules|dist|\.rivet|\.claude|\.cursor|\.github|AGENTS\.md|CLAUDE\.md)(\/|$)/;

export type CheckName = "files" | "rv" | "build" | "typecheck" | "behaviour";
export interface CheckResult {
  check: CheckName;
  ok: boolean;
  /** Why it failed (first lines of the error), or what passed. */
  detail: string;
}
export interface TaskResult {
  id: string;
  ok: boolean;
  checks: CheckResult[];
  ms: number;
}

/** Files of one task's output folder, app-relative (`src/routes/index.tsx`) → contents. */
export function readOutput(dir: string): Map<string, string> {
  const files = new Map<string, string>();
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const path = relative(dir, join(entry.parentPath, entry.name)).split("\\").join("/");
    files.set(path, readFileSync(join(entry.parentPath, entry.name), "utf8"));
  }
  return files;
}

/** The prompt a model gets for a task: the task text plus the project it works in. */
export function promptOf(task: EvalTask): string {
  const files = task.files.map((file) => `- \`${file}\``).join("\n");
  return [
    `# ${task.title}`,
    "",
    `You are working in a Rivet app created from the \`${task.template}\` starter (\`npm create rivet@latest -- --template ${task.template}\`). Follow the project's AGENTS.md.`,
    "",
    task.prompt.trim(),
    "",
    "Create or change only these files (paths from the app root). If you cannot edit files, reply with their full contents:",
    files,
    "",
  ].join("\n");
}

const tail = (text: string, lines = 12) => text.trim().split("\n").slice(-lines).join("\n");
const errorText = (error: unknown) => {
  const e = error as { stdout?: string | Buffer; stderr?: string | Buffer; message?: string };
  return tail(`${e.stdout ?? ""}\n${e.stderr ?? ""}`.trim() || (e.message ?? String(error)));
};

/** Static checks: required files present, forbidden patterns absent. */
export function checkFiles(task: EvalTask, output: ReadonlyMap<string, string>): CheckResult {
  const problems: string[] = [];
  for (const file of task.files) if (!output.has(file)) problems.push(`missing ${file}`);
  for (const [file, text] of output)
    for (const rule of [...(CODE.test(file) ? COMMON_FORBID : []), ...(task.forbid ?? [])])
      if (rule.pattern.test(text)) problems.push(`${file}: ${rule.why} (${rule.pattern})`);
  const code = [...output]
    .filter(([file]) => CODE.test(file))
    .map(([, text]) => text)
    .join("\n");
  for (const rule of task.require ?? []) if (!rule.pattern.test(code)) problems.push(`missing: ${rule.why} (${rule.pattern})`);
  return { check: "files", ok: problems.length === 0, detail: problems.join("\n") || `${output.size} file(s)` };
}

/** Files the common rules apply to: source code (a Markdown or text answer may use arrows and check marks as text). */
const CODE = /\.(tsx?|jsx?|mjs|cjs)$/;

/** Rules for every task's code files: what the project instructions forbid. */
const COMMON_FORBID: { pattern: RegExp; why: string }[] = [
  { pattern: /from\s+["'](react|react-dom|solid-js)(\/[^"']*)?["']/, why: "imports React / Solid" },
  { pattern: /<path\b[^>]*\bd=/, why: "hand-written SVG path (use lucide via @rivetjs/kit/icon)" },
  { pattern: /[\u2713\u2714\u2715\u2716\u2717\u2190-\u2193\u25b2-\u25bc\u2605\u2606]/u, why: "Unicode glyph used as an icon" },
  { pattern: /dangerouslySetInnerHTML|innerHTML\s*=/, why: "raw HTML injection" },
  { pattern: /\buse(State|Effect|LayoutEffect|Memo|Callback|Reducer)\s*[<(]/, why: "React hooks (signal / computed / clientEffect)" },
  {
    // Seen in a cold run (2026-11-05): `<Drawer isOpen={open()} onOpenChange={…}>` never opened. Two-way props take the signal.
    pattern: /\bisOpen=\{\s*[\w.]+\(\)\s*\}[^>]*\bonOpenChange=/,
    why: "React-style controlled overlay (pass the signal: isOpen={open})",
  },
];

/** Rivet compiler + language-service diagnostics of every `.ts` / `.tsx` output file, in the staged app. */
export function checkRv(output: ReadonlyMap<string, string>, cwd: string): CheckResult {
  const problems: string[] = [];
  for (const [file, text] of output) {
    if (!/\.(tsx|jsx|ts)$/.test(file) || file.endsWith(".d.ts")) continue;
    const result = checkCode(text, { filename: file, cwd, types: false });
    for (const d of result.diagnostics.filter((d) => d.severity === "error"))
      problems.push(`${file}:${d.line ?? "?"}:${d.column ?? "?"} ${d.code}: ${d.message}${d.fix ? `\n  fix: ${d.fix}` : ""}`);
  }
  return { check: "rv", ok: problems.length === 0, detail: problems.join("\n") || "no RV errors" };
}

/** Copy the task's starter into the stage folder and write the output files over it. */
export function stage(task: EvalTask, output: ReadonlyMap<string, string>): string {
  const dir = resolve(STAGE, task.id);
  rmSync(dir, { recursive: true, force: true });
  const from = resolve(TEMPLATES, `starter-${task.template}`);
  cpSync(from, dir, { recursive: true, filter: (source) => !SKIP.test(relative(from, source).split("\\").join("/")) });
  for (const [file, text] of output) {
    const target = resolve(dir, file);
    if (!target.startsWith(dir + "/")) throw new Error(`${task.id}: output path ${file} leaves the app`);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text);
  }
  return dir;
}

const run = (dir: string, argv: string[], env: Record<string, string> = {}) =>
  execFileSync(process.execPath, argv, {
    cwd: dir,
    encoding: "utf8",
    stdio: "pipe",
    env: { ...process.env, NODE_ENV: "production", NO_COLOR: "1", ...env },
    maxBuffer: 64 << 20,
  });

/**
 * The steps of an npm `build` script: `a && b`, each with leading `NAME=value` assignments, single / double quoted
 * arguments and backslash escapes. Only `vite …` and `node …` steps run (through this Node and the workspace Vite, no
 * shell): pipes, `;`, `||`, redirects and other commands are refused with the step named.
 */
export function buildSteps(script: string): { env: Record<string, string>; bin: string; args: string[] }[] {
  const steps: { env: Record<string, string>; bin: string; args: string[] }[] = [];
  let words: string[] = [];
  let word: string | null = null;
  const end = () => {
    if (word !== null) words.push(word);
    word = null;
  };
  const step = () => {
    end();
    const env: Record<string, string> = {};
    while (words.length && /^[A-Za-z_]\w*=/.test(words[0]!)) {
      const [name, ...value] = words.shift()!.split("=");
      env[name!] = value.join("=");
    }
    const [bin, ...args] = words;
    if (!bin) throw new Error(`empty build step in ${JSON.stringify(script)}`);
    steps.push({ env, bin, args });
    words = [];
  };
  for (let i = 0; i < script.length; i++) {
    const c = script[i]!;
    if (c === "'" || c === '"') {
      const close = script.indexOf(c, i + 1);
      if (close < 0) throw new Error(`unterminated quote in build script ${JSON.stringify(script)}`);
      word = (word ?? "") + script.slice(i + 1, close);
      i = close;
    } else if (c === "\\" && i + 1 < script.length) word = (word ?? "") + script[++i];
    else if (c === "&" && script[i + 1] === "&") (step(), i++);
    else if (/[|;<>&`$()]/.test(c)) throw new Error(`unsupported shell syntax ${JSON.stringify(c)} in build script ${JSON.stringify(script)}`);
    else if (/\s/.test(c)) end();
    else word = (word ?? "") + c;
  }
  step();
  return steps;
}

/** `npm run build` of the starter, step by step (`vite …` / `node …`, see `buildSteps`), from the staged folder. */
export function build(task: EvalTask, dir: string): CheckResult {
  const script = (JSON.parse(readFileSync(resolve(dir, "package.json"), "utf8")) as { scripts: Record<string, string> }).scripts.build!;
  try {
    for (const { env, bin, args } of buildSteps(script)) {
      if (bin === "vite") run(dir, [VITE, ...args, "--logLevel", "error"], env);
      else if (bin === "node") run(dir, args, env);
      else throw new Error(`unexpected build step ${bin} ${args.join(" ")} (only vite / node steps run)`);
    }
    return { check: "build", ok: true, detail: script };
  } catch (error) {
    return { check: "build", ok: false, detail: errorText(error) };
  }
}

/**
 * `tsc -p .` over the staged app. Only errors in the app's own files count: the workspace packages are
 * TypeScript sources (`../../../libs/…`), and an error inside one is not the model's.
 */
export function typecheck(dir: string): CheckResult {
  try {
    run(dir, [TSC, "-p", ".", "--noEmit", "--pretty", "false"]);
    return { check: "typecheck", ok: true, detail: "tsc -p ." };
  } catch (error) {
    const output = String((error as { stdout?: string }).stdout ?? "");
    const blocks = output.split(/\n(?=\S)/).filter((block) => /error TS\d+/.test(block));
    const own = blocks.filter((block) => !block.startsWith("../"));
    if (blocks.length && !own.length) return { check: "typecheck", ok: true, detail: `tsc -p . (${blocks.length} error(s) in workspace packages ignored)` };
    return { check: "typecheck", ok: false, detail: own.length ? tail(own.join("\n"), 16) : errorText(error) };
  }
}

/** Start the built app (`node serve.js`, PORT=0) and resolve with its URL. */
async function serveApp(dir: string): Promise<{ url: string; stop: () => Promise<void> }> {
  const child = spawn(process.execPath, ["serve.js"], { cwd: dir, env: { ...process.env, PORT: "0", HOST: "127.0.0.1", NO_COLOR: "1" }, stdio: "pipe" });
  let output = "";
  const url = await new Promise<string>((done, fail) => {
    const timer = setTimeout(() => fail(new Error(`no URL printed in 30 s:\n${output}`)), 30_000);
    const read = (chunk: Buffer) => {
      output += chunk;
      const match = /(http:\/\/[\w.:[\]-]+)/.exec(output);
      if (match) (clearTimeout(timer), done(match[1]!));
    };
    child.stdout.on("data", read);
    child.stderr.on("data", read);
    child.on("exit", (code) => (clearTimeout(timer), fail(new Error(`server exited ${code}:\n${output}`))));
  });
  // Resolves once the server process is gone, so the next task never races its port or files.
  const stop = () =>
    new Promise<void>((done) => {
      if (child.exitCode !== null || child.signalCode !== null) return done();
      const force = setTimeout(() => child.kill("SIGKILL"), 5_000);
      child.once("exit", () => (clearTimeout(force), done()));
      child.kill();
    });
  return { url, stop };
}

type Browser = import("playwright").Browser;

/** Serve the built app, open `task.open`, run the steps; fail on any page or console error. */
export async function behaviour(task: EvalTask, dir: string, browser: Browser): Promise<CheckResult> {
  const { run: runStep } = await import("../../libs/docs-kit/tools/example-checks.ts");
  let server: Awaited<ReturnType<typeof serveApp>> | undefined;
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const errors: string[] = [];
  try {
    server = await serveApp(dir);
    for (const [path, status] of Object.entries(task.status ?? {})) {
      const got = (await fetch(new URL(path, server.url), { redirect: "manual" })).status;
      if (got !== status) throw new Error(`GET ${path}: status ${got}, expected ${status}`);
    }
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(`page error: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error" && !/^Failed to load resource: /.test(message.text())) errors.push(`console error: ${message.text()}`);
    });
    await page.goto(new URL(task.open ?? "/", server.url).href, { waitUntil: "load" });
    for (const step of task.steps) {
      await runEvalStep(page, step, task.id, runStep);
      if (errors.length) break;
    }
    if (errors.length) throw new Error(errors.join("\n"));
    return { check: "behaviour", ok: true, detail: `${task.steps.length} step(s)` };
  } catch (error) {
    return { check: "behaviour", ok: false, detail: tail([(error as Error).message, ...errors].join("\n")) };
  } finally {
    await context.close();
    await server?.stop();
  }
}

async function runEvalStep(
  page: import("playwright").Page,
  step: EvalStep,
  id: string,
  runStep: (page: import("playwright").Page, step: import("../../libs/docs-kit/define.ts").Step, id: string) => Promise<void>,
): Promise<void> {
  if ("reload" in step) await page.reload({ waitUntil: "load" });
  else if ("viewport" in step) await page.setViewportSize({ width: step.viewport[0], height: step.viewport[1] });
  else if ("count" in step)
    await page
      .waitForFunction(([selector, n]) => document.querySelectorAll(selector as string).length === n, step.count, { timeout: 5000 })
      .catch(async () => {
        const got = await page.evaluate((selector) => document.querySelectorAll(selector).length, step.count[0]);
        throw new Error(`task ${id}: step ${JSON.stringify(step)} failed (found ${got})`);
      });
  else await runStep(page, step, id);
}

/** Grade one task's output. */
export async function gradeTask(task: EvalTask, output: ReadonlyMap<string, string>, browser: () => Promise<Browser>): Promise<TaskResult> {
  const started = Date.now();
  const checks: CheckResult[] = [];
  const done = () => ({ id: task.id, ok: checks.length === 5 && checks.every((c) => c.ok), checks, ms: Date.now() - started });
  checks.push(checkFiles(task, output));
  if (!checks.at(-1)!.ok) return done();
  const dir = stage(task, output);
  checks.push(checkRv(output, dir));
  if (!checks.at(-1)!.ok) return done();
  checks.push(build(task, dir));
  if (!checks.at(-1)!.ok) return done();
  checks.push(typecheck(dir));
  if (!checks.at(-1)!.ok) return done();
  checks.push(await behaviour(task, dir, await browser()));
  return done();
}

/** Grade tasks (`ids` empty = all) from `outputs/<id>/` (or `reference/<id>/`). */
export async function grade(options: { outputs: string; ids?: readonly string[]; keep?: boolean; log?: (line: string) => void }): Promise<TaskResult[]> {
  const unknown = (options.ids ?? []).filter((id) => !TASKS.some((task) => task.id === id));
  if (unknown.length) throw new Error(`unknown task(s): ${unknown.join(", ")}`);
  const tasks = options.ids?.length ? TASKS.filter((task) => options.ids!.includes(task.id)) : TASKS;
  let browser: Browser | undefined;
  const open = async () => (browser ??= await (await import("playwright")).chromium.launch());
  const results: TaskResult[] = [];
  try {
    for (const task of tasks) {
      try {
        const result = await gradeTask(task, readOutput(resolve(options.outputs, task.id)), open);
        results.push(result);
        options.log?.(formatResult(result));
      } finally {
        // Also when grading threw (stage / browser error): no staged app is left behind.
        if (!options.keep) rmSync(resolve(STAGE, task.id), { recursive: true, force: true });
      }
    }
  } finally {
    await browser?.close();
  }
  return results;
}

export function formatResult(result: TaskResult): string {
  const marks = result.checks.map((c) => `${c.check} ${c.ok ? "ok" : "FAIL"}`).join(", ");
  const failed = result.checks.find((c) => !c.ok);
  return `${result.ok ? "PASS" : "FAIL"} ${result.id} (${(result.ms / 1000).toFixed(1)} s): ${marks}${failed ? `\n  ${failed.detail.split("\n").join("\n  ")}` : ""}`;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const value = (flag: string) => {
    const at = argv.indexOf(flag);
    return at >= 0 ? argv[at + 1] : undefined;
  };
  const flags = new Set(["--outputs", "--json", "--out", "--from"]);
  const positional = argv.filter((arg, i) => !arg.startsWith("--") && !flags.has(argv[i - 1] ?? ""));
  if (argv.includes("--help") || argv.length === 0) {
    const header = readFileSync(import.meta.filename, "utf8").split("\n");
    console.log(
      header
        .slice(
          0,
          header.findIndex((line) => !line.startsWith("//")),
        )
        .join("\n")
        .replace(/^\/\/ ?/gm, ""),
    );
    process.exit(argv.length ? 0 : 2);
  }
  const taskOf = (id: string | undefined) => {
    const task = TASKS.find((t) => t.id === id);
    if (!task) throw new Error(`ai-eval: unknown task ${id ?? "(none)"}; tasks: ${TASKS.map((t) => t.id).join(", ")}`);
    return task;
  };
  if (positional[0] === "workspace") {
    // Inside the repo by default, so the app resolves the workspace packages without an install.
    const task = taskOf(positional[1]);
    const out = resolve(value("--out") ?? `.artifacts/ai-eval/work/${task.id}`);
    rmSync(out, { recursive: true, force: true });
    const from = resolve(TEMPLATES, `starter-${task.template}`);
    cpSync(from, out, { recursive: true, filter: (source) => !/^(node_modules|dist|\.rivet)(\/|$)/.test(relative(from, source).split("\\").join("/")) });
    writeFileSync(resolve(out, "TASK.md"), promptOf(task));
    console.log(`ai-eval: ${task.id} workspace in ${relative(process.cwd(), out)} (prompt: TASK.md)`);
  } else if (positional[0] === "collect") {
    const task = taskOf(positional[1]);
    const from = value("--from");
    const outputs = value("--outputs");
    if (!from || !outputs) throw new Error("ai-eval collect: --from <workspace> and --outputs <dir> required");
    const target = resolve(outputs, task.id);
    rmSync(target, { recursive: true, force: true });
    const missing: string[] = [];
    for (const file of task.files) {
      if (!existsSync(resolve(from, file))) {
        missing.push(file);
        continue;
      }
      mkdirSync(dirname(resolve(target, file)), { recursive: true });
      cpSync(resolve(from, file), resolve(target, file));
    }
    console.log(
      `ai-eval: collected ${task.files.length - missing.length}/${task.files.length} file(s) of ${task.id}${missing.length ? ` (missing: ${missing.join(", ")})` : ""}`,
    );
  } else if (positional[0] === "prompts") {
    const out = resolve(value("--out") ?? ".artifacts/ai-eval/prompts");
    mkdirSync(out, { recursive: true });
    for (const task of TASKS) writeFileSync(resolve(out, `${task.id}.md`), promptOf(task));
    console.log(`ai-eval: ${TASKS.length} prompts in ${relative(process.cwd(), out) || "."}`);
  } else {
    const outputs = argv.includes("--reference") ? resolve(import.meta.dirname, "reference") : value("--outputs");
    if (!outputs) throw new Error("ai-eval: --outputs <dir> or --reference required");
    const results = await grade({ outputs: resolve(outputs), ids: positional, keep: argv.includes("--keep"), log: console.log });
    const passed = results.filter((r) => r.ok).length;
    console.log(`\nai-eval: ${passed}/${results.length} task(s) pass`);
    const json = value("--json");
    if (json)
      writeFileSync(resolve(json), JSON.stringify({ outputs: relative(REPO, resolve(outputs)), passed, total: results.length, results }, null, 2) + "\n");
    process.exit(passed === results.length ? 0 : 1);
  }
}
