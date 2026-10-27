// Cold first-interaction matrix (COLD-HARNESS, 2026-10-27): every live example's frame page, loaded cold (fresh
// browser context = empty cache and storage, no prior event) and driven by its own `test` steps, in every cell of
//   engine (chromium / webkit / firefox) × input (mouse / touch / phone) × storage (normal / throws / denied) × timing (early / idle).
// Per run it fails on: a failed step (the DOM did not change as the example expects), a `rivet:resume-error`, a
// document reload or other full navigation the steps did not ask for, console / page errors, and a `contextmenu`
// step's default not prevented (steps: `example-checks.ts` `run`). Input `touch` runs in a touch phone context
// (`devices["iPhone 15"]` user agent, hasTouch, isMobile, coarse pointer) at a 1280×800 viewport, `phone` in the whole
// iPhone 15 descriptor (390 px layout); both turn `click` / `tap` steps into `page.tap`.
// Storage `throws`: `localStorage` / `sessionStorage` writes (setItem and property sets) throw `QuotaExceededError`
// (older iOS private mode); `denied`: reading the properties throws `SecurityError` (cookies blocked).
// Timing `early`: the first step runs right after `load` (the event lands while chunks may still load); `idle`: after
// the page is quiet (as the build's example checks). Known reds: `<app>/examples/_cold-reds.json` (+ the app's
// `_quarantine.json` entries, every cell). CLI: `node libs/docs-kit/cli.ts cold <app> [options]` (`coldCommand`).
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Step } from "../define.ts";
import type { ExampleData } from "../components/types.ts";
import { framePath } from "../frame-theme.ts";
import { CHROMIUM_ARGS, QUARANTINE, quiet, run, serveClient, type Traffic } from "./example-checks.ts";
import { EXAMPLES_JSON } from "./examples.ts";

export const ENGINES = ["chromium", "webkit", "firefox"] as const;
export const INPUTS = ["mouse", "touch", "phone"] as const;
export const STORAGES = ["normal", "throws", "denied"] as const;
export const TIMINGS = ["early", "idle"] as const;
export type Engine = (typeof ENGINES)[number];
export type Input = (typeof INPUTS)[number];
export type Storage = (typeof STORAGES)[number];
export type Timing = (typeof TIMINGS)[number];
export interface Cell {
  engine: Engine;
  input: Input;
  storage: Storage;
  timing: Timing;
}
/** Known reds of the cold matrix (app-relative, optional). */
export const COLD_REDS = "examples/_cold-reds.json";
/** Default output dir of `cold` (app-relative): frames builds, `cold.json`, `cold.md`. */
export const COLD_DIST = ".artifacts/cold";

/** `chromium/touch/throws/early`. */
export const cellName = (cell: Cell): string => `${cell.engine}/${cell.input}/${cell.storage}/${cell.timing}`;

/** Every combination of the lists, engine-major (one browser at a time). */
export function cells(engines: readonly Engine[], inputs: readonly Input[], storages: readonly Storage[], timings: readonly Timing[]): Cell[] {
  const out: Cell[] = [];
  for (const engine of engines)
    for (const input of inputs) for (const storage of storages) for (const timing of timings) out.push({ engine, input, storage, timing });
  return out;
}

/** Parse a comma list against the allowed values. */
export function parseList<T extends string>(text: string | undefined, allowed: readonly T[], fallback: readonly T[], what: string): T[] {
  if (!text) return [...fallback];
  const list = text.split(",").filter(Boolean);
  for (const value of list) if (!allowed.includes(value as T)) throw new Error(`cold: unknown ${what} "${value}" (${allowed.join(", ")})`);
  return list as T[];
}

/** Shard `i/n` (1-based) of `list`: every n-th item from i (stable: ids sorted by the caller). */
export function shard<T>(list: readonly T[], spec: string | undefined): T[] {
  if (!spec) return [...list];
  const match = /^(\d+)\/(\d+)$/.exec(spec);
  const i = match ? Number(match[1]) : 0;
  const n = match ? Number(match[2]) : 0;
  if (!match || n < 1 || i < 1 || i > n) throw new Error(`cold: bad shard "${spec}" (i/n, 1 ≤ i ≤ n)`);
  return list.filter((_, at) => at % n === i - 1);
}

const INPUT_KINDS = ["click", "fill", "press", "key", "dblclick", "rightclick", "contextmenu", "longpress", "hover", "wheel", "drag", "tap"];
const isInput = (step: Step) => INPUT_KINDS.some((kind) => kind in step);

/**
 * Why the steps cannot run in `cell` (null: they can). Touch cells need a first input step a finger can do (click, tap,
 * fill, press, key); a `tap` step needs a touch context (mouse cells skip it outside Chromium, whose CDP tap needs none);
 * Playwright's mobile WebKit has no mouse wheel (touch / phone cells skip `wheel` steps there).
 */
export function skipReason(steps: readonly Step[], cell: Cell): string | null {
  const first = steps.find(isInput);
  if (!first) return "no input step";
  if (cell.input !== "mouse" && !("click" in first || "tap" in first || "fill" in first || "press" in first || "key" in first))
    return `first input ${Object.keys(first)[0]} has no touch form`;
  if (cell.input === "mouse" && cell.engine !== "chromium" && steps.some((step) => "tap" in step)) return "tap step needs a touch context";
  if (cell.input !== "mouse" && cell.engine === "webkit" && steps.some((step) => "wheel" in step)) return "wheel step: no mouse wheel in mobile WebKit";
  return null;
}

/** Index of the step whose failure counts as the cold interaction's: the first input step and the steps up to the next input step. */
export function coldSpan(steps: readonly Step[]): number {
  const first = steps.findIndex(isInput);
  if (first < 0) return -1;
  const next = steps.findIndex((step, at) => at > first && isInput(step));
  return next < 0 ? steps.length - 1 : next - 1;
}

export interface KnownRed {
  /** Example id. */
  id: string;
  /** Cell pattern: `engine/input/storage/timing`, `*` per part (default every cell). */
  cells?: string;
  reason: string;
  owner?: string;
}

/** Does `pattern` (`webkit/*` — missing parts = `*`) match `cell`? */
export function cellMatches(pattern: string | undefined, cell: Cell): boolean {
  if (!pattern) return true;
  const parts = pattern.split("/");
  const values = [cell.engine, cell.input, cell.storage, cell.timing];
  return values.every((value, at) => !parts[at] || parts[at] === "*" || parts[at]!.split("|").includes(value));
}

/** The known red covering `id` in `cell`, if any. */
export function knownRed(reds: readonly KnownRed[], id: string, cell: Cell): KnownRed | undefined {
  return reds.find((red) => red.id === id && cellMatches(red.cells, cell));
}

/** Storage init script (`page.addInitScript`; self-contained). */
export function storageInit(mode: Storage): void {
  if (mode === "normal") return;
  for (const name of ["localStorage", "sessionStorage"] as const) {
    let real: Storage | undefined;
    try {
      real = window[name] as unknown as Storage;
    } catch {
      continue;
    }
    if (mode === "denied") {
      Object.defineProperty(window, name, {
        configurable: true,
        enumerable: true,
        get() {
          throw new DOMException("The operation is insecure.", "SecurityError");
        },
      });
      continue;
    }
    const quota = () => new DOMException("The quota has been exceeded.", "QuotaExceededError");
    const target = real as unknown as object;
    const proxy = new Proxy(target, {
      get(t, key) {
        if (key === "setItem")
          return () => {
            throw quota();
          };
        const value = Reflect.get(t, key, t);
        return typeof value === "function" ? value.bind(t) : value;
      },
      set() {
        throw quota();
      },
      defineProperty() {
        throw quota();
      },
    });
    Object.defineProperty(window, name, { configurable: true, enumerable: true, get: () => proxy });
  }
}

/** Error collector init script: `rivet:resume-error` details and uncaught errors go to the exposed `__rvCold` binding (survives a reload). */
function errorInit(): void {
  const w = window as unknown as { __rvCold: (text: string) => void; __rvColdOn?: boolean };
  if (w.__rvColdOn) return;
  w.__rvColdOn = true;
  document.addEventListener("rivet:resume-error", (event) => {
    const detail = (event as CustomEvent).detail as { symbol?: unknown; error?: { message?: string }; message?: string } | undefined;
    w.__rvCold("rivet:resume-error " + (detail?.symbol ? String(detail.symbol) + ": " : "") + (detail?.error?.message ?? detail?.message ?? String(detail)));
  });
  addEventListener("unhandledrejection", (event) =>
    w.__rvCold("unhandledrejection " + String((event as PromiseRejectionEvent).reason?.message ?? (event as PromiseRejectionEvent).reason)),
  );
}

export type Verdict = "pass" | "red" | "known" | "flaky" | "skip" | "fixed";
export interface ColdResult {
  id: string;
  cell: string;
  verdict: Verdict;
  /** Failure (first line), skip reason or known-red reason. */
  detail?: string;
  /** The failing step was the cold interaction (or its first assertions). */
  cold?: boolean;
  /** Document loads after the first one (reloads / navigations) seen. */
  reloads?: number;
  /** Passed, but every assertion of the cold span already held before the first input (the steps prove nothing about it). */
  vacuous?: boolean;
}

/** Assertion steps a page can answer at once (`holds`); `name` / `described` are not checked. */
const CHECKABLE = ["expect", "attr", "matches", "absent", "focused"];

/** Does the assertion `step` hold right now (no waiting)? */
async function holds(page: import("playwright").Page, step: Step): Promise<boolean> {
  return page
    .evaluate((step) => {
      if ("expect" in step) return document.querySelector(step.expect[0])?.textContent?.includes(step.expect[1]) ?? false;
      if ("attr" in step) return (document.querySelector(step.attr[0])?.getAttribute(step.attr[1]) ?? null) === step.attr[2];
      if ("matches" in step) return document.querySelector(step.matches) !== null;
      if ("absent" in step) return document.querySelector(step.absent) === null;
      if ("focused" in step) return document.activeElement?.matches(step.focused) ?? false;
      return false;
    }, step)
    .catch(() => false);
}

/** Benign console noise of a browser, not the page (WebKit reports aborted prefetches of a closing page). */
const NOISE = [/^ResizeObserver loop/, /Failed to load resource: the network connection was lost/];

async function one(
  browser: import("playwright").Browser,
  origin: string,
  example: ExampleData,
  cell: Cell,
  devices: typeof import("playwright").devices,
  note: { vacuous?: boolean } = {},
): Promise<Omit<ColdResult, "id" | "cell" | "verdict"> | null> {
  const steps = example.test ?? [];
  const touch = cell.input !== "mouse";
  // touch: a touch phone (iPhone user agent, hasTouch, isMobile, coarse pointer) at the desktop viewport the steps are
  // written for; phone: the whole iPhone 15 descriptor (390 px layout: steps written for desktop layouts may not apply).
  const iphone = { ...devices["iPhone 15"], deviceScaleFactor: 1 };
  const desktop = { width: 1280, height: 800 };
  const context = await browser.newContext(
    cell.input === "phone" ? iphone : cell.input === "touch" ? { ...iphone, viewport: desktop, screen: desktop } : { viewport: desktop },
  );
  const errors: string[] = [];
  try {
    await context.exposeFunction("__rvCold", (text: string) => errors.push(text));
    await context.addInitScript(storageInit, cell.storage);
    await context.addInitScript(errorInit);
    await context.addInitScript(() => performance.setResourceTimingBufferSize(100_000));
    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error" && !NOISE.some((re) => re.test(message.text()))) errors.push("console " + message.text());
    });
    page.on("pageerror", (error) => !NOISE.some((re) => re.test(error.message)) && errors.push("pageerror " + error.message));
    const traffic: Traffic = { inflight: 0, total: 0, resources: 0 };
    page.on("request", (request) => {
      if (new URL(request.url()).origin !== origin) return;
      traffic.inflight++;
      traffic.total++;
      if (!(request.isNavigationRequest() && request.frame() === page.mainFrame())) traffic.resources++;
    });
    const settled = (request: import("playwright").Request) => new URL(request.url()).origin === origin && traffic.inflight--;
    page.on("requestfinished", settled);
    page.on("requestfailed", settled);
    const url = origin + framePath(example.id);
    let loads = 0;
    const reloads: string[] = [];
    page.on("domcontentloaded", () => {
      if (loads++) reloads.push(page.url());
    });
    const response = await page.goto(url, { waitUntil: "load" });
    if (response?.status() !== 200) throw new Error(`${framePath(example.id)} returned ${response?.status()}`);
    if (cell.timing === "idle") await quiet(page, traffic);
    const span = coldSpan(steps);
    const first = steps.findIndex(isInput);
    let at = 0;
    try {
      for (; at < steps.length; at++) {
        if (at === first) {
          // Vacuous check: the cold span's assertions must not already hold on the untouched page.
          const asserts = steps.slice(first + 1, span + 1).filter((step) => CHECKABLE.some((kind) => kind in step));
          let all = asserts.length > 0;
          for (const step of asserts) if (all) all = await holds(page, step);
          note.vacuous = all;
        }
        await run(page, steps[at]!, example.id, { touch });
      }
      // Late failures of the interaction (a reload or resume error after the last step's assertion).
      await quiet(page, traffic);
    } catch (error) {
      const message = (error as Error).message.split("\n")[0]!;
      return {
        detail: message + (errors.length ? ` [${errors.slice(0, 2).join(" | ")}]` : "") + (reloads.length ? ` [reloaded ${reloads.length}×]` : ""),
        cold: at <= span,
        reloads: reloads.length,
      };
    }
    const own = reloads.filter((href) => new URL(href).pathname === new URL(url).pathname);
    if (own.length)
      return { detail: `page reloaded ${own.length}× during the steps` + (errors.length ? ` [${errors[0]}]` : ""), cold: true, reloads: own.length };
    if (errors.length) return { detail: `errors: ${errors.slice(0, 3).join(" | ")}`, cold: true, reloads: reloads.length };
    return null;
  } finally {
    await context.close();
  }
}

export interface ColdOptions {
  cells: readonly Cell[];
  /** Only these example ids (after the shard). */
  only?: readonly string[];
  /** `i/n`. */
  shard?: string;
  /** Pages at once per browser (default 4; env `DOCS_KIT_COLD_CONCURRENCY`). */
  concurrency?: number;
  log?: (message: string) => void;
}

/** The live examples with steps, sorted by id, after `only` (the shard is applied by the caller before a frames build). */
export function coldExamples(examples: Readonly<Record<string, ExampleData>>, only?: readonly string[]): ExampleData[] {
  const set = only && new Set(only);
  return Object.values(examples)
    .filter((example) => !example.codeOnly && example.test?.some(isInput) && (!set || set.has(example.id)))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Run the matrix over `list` against the built client dir; one browser at a time (engine-major), failures re-run once alone. */
export async function coldMatrix(root: string, client: string, list: readonly ExampleData[], options: ColdOptions): Promise<ColdResult[]> {
  const log = options.log ?? ((message: string) => console.log(message));
  const concurrency = Math.max(1, options.concurrency ?? (Number(process.env.DOCS_KIT_COLD_CONCURRENCY) || 4));
  const reds: KnownRed[] = await readFile(resolve(root, COLD_REDS), "utf8").then(
    (text) => JSON.parse(text) as KnownRed[],
    () => [],
  );
  const quarantine: Record<string, { step: string; reason: string }> = await readFile(resolve(root, QUARANTINE), "utf8").then(
    (text) => JSON.parse(text),
    () => ({}),
  );
  const known = [...reds, ...Object.entries(quarantine).map(([id, q]) => ({ id, reason: `quarantined: ${q.reason}` }))];
  const playwright = await import("playwright");
  const server = await serveClient(resolve(client));
  const results: ColdResult[] = [];
  try {
    for (const engine of [...new Set(options.cells.map((cell) => cell.engine))]) {
      const browser = await playwright[engine].launch({
        headless: true,
        ...(engine === "chromium" ? { args: CHROMIUM_ARGS } : {}),
        ...(engine === "chromium" && process.env.DOCS_KIT_CHROMIUM_PATH ? { executablePath: process.env.DOCS_KIT_CHROMIUM_PATH } : {}),
      });
      try {
        for (const cell of options.cells.filter((c) => c.engine === engine)) {
          const name = cellName(cell);
          const todo: ExampleData[] = [];
          for (const example of list) {
            const skip = skipReason(example.test ?? [], cell);
            if (skip) results.push({ id: example.id, cell: name, verdict: "skip", detail: skip });
            else todo.push(example);
          }
          const failed: ExampleData[] = [];
          let at = 0;
          const lane = async () => {
            while (at < todo.length) {
              const example = todo[at++]!;
              const note: { vacuous?: boolean } = {};
              const outcome = await one(browser, server.url, example, cell, playwright.devices, note).catch((error: Error) => ({
                detail: error.message.split("\n")[0]!,
                cold: true,
              }));
              if (outcome) failed.push(example);
              else {
                const red = knownRed(known, example.id, cell);
                results.push({
                  id: example.id,
                  cell: name,
                  verdict: red ? "fixed" : "pass",
                  ...(red ? { detail: `known red passes: ${red.reason}` } : {}),
                  ...(note.vacuous ? { vacuous: true } : {}),
                });
              }
            }
          };
          await Promise.all(Array.from({ length: Math.min(concurrency, todo.length) }, lane));
          // Concurrent pages shift timing: a failure is re-run alone; passing alone = flaky (reported, not red).
          for (const example of failed) {
            const outcome = await one(browser, server.url, example, cell, playwright.devices).catch((error: Error) => ({
              detail: error.message.split("\n")[0]!,
              cold: true,
            }));
            const red = knownRed(known, example.id, cell);
            if (!outcome) results.push({ id: example.id, cell: name, verdict: "flaky", detail: "failed with others, passed alone" });
            else
              results.push({
                id: example.id,
                cell: name,
                verdict: red ? "known" : "red",
                ...outcome,
                detail: red ? `${red.reason} — ${outcome.detail}` : outcome.detail,
              });
          }
          const count = (verdict: Verdict) => results.filter((r) => r.cell === name && r.verdict === verdict).length;
          log(
            `cold ${name}: ${count("pass")} pass, ${count("red")} red, ${count("known")} known, ${count("flaky")} flaky, ${count("fixed")} fixed, ${count("skip")} skip`,
          );
        }
      } finally {
        await browser.close();
      }
    }
  } finally {
    await server.close();
  }
  return results;
}

/** Markdown report: per-cell counts, then every non-pass result. */
export function coldReport(results: readonly ColdResult[], title: string): string {
  const names = [...new Set(results.map((r) => r.cell))];
  const verdicts: Verdict[] = ["pass", "red", "known", "flaky", "fixed", "skip"];
  const lines = [`# ${title}`, "", `| cell | ${verdicts.join(" | ")} | vacuous |`, `| --- | ${verdicts.map(() => "---:").join(" | ")} | ---: |`];
  for (const name of names)
    lines.push(
      `| ${name} | ${verdicts.map((v) => results.filter((r) => r.cell === name && r.verdict === v).length).join(" | ")} | ${results.filter((r) => r.cell === name && r.vacuous).length} |`,
    );
  const bad = results.filter((r) => r.verdict === "red" || r.verdict === "known" || r.verdict === "flaky" || r.verdict === "fixed");
  if (bad.length) {
    lines.push("", "| example | cell | verdict | cold | detail |", "| --- | --- | --- | --- | --- |");
    for (const r of [...bad].sort((a, b) => (a.id + a.cell < b.id + b.cell ? -1 : 1)))
      lines.push(
        `| ${r.id} | ${r.cell} | ${r.verdict} | ${r.cold === undefined ? "" : r.cold ? "yes" : "later"} | ${(r.detail ?? "").replace(/\|/g, "\\|").slice(0, 300)} |`,
      );
  }
  // Passing examples whose first assertions held before the first input (in every cell they ran in): steps to tighten.
  const vacuous = [...new Set(results.filter((r) => r.vacuous).map((r) => r.id))].sort();
  if (vacuous.length) lines.push("", `Vacuous cold span (assertions after the first input already held before it): ${vacuous.join(", ")}`);
  return lines.join("\n") + "\n";
}

/**
 * `node libs/docs-kit/cli.ts cold <app> [--client dir | --frames] [--engines chromium,webkit] [--inputs mouse,touch]
 *   [--storage normal,throws] [--timing early] [--shard i/n] [--only id,…] [--out dir] [--keep]`
 * `--client`: a built client dir (default `<app>/dist/client`, a full site build); `--frames`: a frames-only build of
 * the shard's examples (`buildFrames`, as `check-examples`; `--keep` leaves it in `<out>/frames` for repros). Env `RIVET_COLD_SHARD` = `--shard`. Writes `cold.json` +
 * `cold.md` to `--out` (default `<app>/.artifacts/cold`); exit 1 on a red.
 */
export async function coldCommand(root: string, args: readonly string[]): Promise<void> {
  const flags = new Map<string, string>();
  const bools = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--frames" || arg === "--keep") bools.add(arg.slice(2));
    else if (arg.startsWith("--")) flags.set(arg.slice(2), args[++i] ?? "");
    else throw new Error(`cold: unexpected argument ${arg}`);
  }
  const list = cells(
    parseList(flags.get("engines"), ENGINES, ["chromium", "webkit"], "engine"),
    parseList(flags.get("inputs"), INPUTS, ["mouse", "touch"], "input"),
    parseList(flags.get("storage"), STORAGES, ["normal", "throws"], "storage"),
    parseList(flags.get("timing"), TIMINGS, ["early"], "timing"),
  );
  const out = resolve(root, flags.get("out") ?? COLD_DIST);
  const spec = flags.get("shard") ?? process.env.RIVET_COLD_SHARD;
  const only = flags.get("only")?.split(",").filter(Boolean);
  let client = resolve(root, flags.get("client") ?? "dist/client");
  let examples: Record<string, ExampleData>;
  if (bools.has("frames")) {
    const { generateExamples } = await import("./examples.ts");
    examples = (await generateExamples(root)).examples as Record<string, ExampleData>;
    const ids = shard(coldExamples(examples, only), spec).map((example) => example.id);
    if (!ids.length) return console.log("cold: no examples in this shard");
    const { buildFrames } = await import("./check-examples.ts");
    const frames = await buildFrames(root, ids, { dist: resolve(out, "frames") });
    client = frames.build.client;
    examples = JSON.parse(await readFile(resolve(root, EXAMPLES_JSON), "utf8")) as Record<string, ExampleData>;
  } else {
    if (!existsSync(client)) throw new Error(`cold: no build at ${client} (build the site, or pass --frames / --client)`);
    examples = JSON.parse(await readFile(resolve(root, EXAMPLES_JSON), "utf8")) as Record<string, ExampleData>;
  }
  const reds: KnownRed[] = await readFile(resolve(root, COLD_REDS), "utf8").then(
    (text) => JSON.parse(text) as KnownRed[],
    () => [],
  );
  for (const red of reds) if (!examples[red.id]) throw new Error(`${COLD_REDS}: unknown example ${red.id}`);
  const todo = shard(coldExamples(examples, only), spec);
  console.log(`cold: ${todo.length} example(s) × ${list.length} cell(s)${spec ? ` (shard ${spec})` : ""} against ${client}`);
  const results = await coldMatrix(root, client, todo, { cells: list });
  await mkdir(out, { recursive: true });
  await writeFile(resolve(out, "cold.json"), JSON.stringify(results, null, 1) + "\n");
  const report = coldReport(results, `Cold matrix: ${root.split("/").pop()}${spec ? ` shard ${spec}` : ""}`);
  await writeFile(resolve(out, "cold.md"), report);
  if (bools.has("frames") && !bools.has("keep")) await rm(resolve(out, "frames"), { recursive: true, force: true });
  const red = results.filter((r) => r.verdict === "red");
  for (const r of red) console.log(`cold: RED ${r.id} ${r.cell}${r.cold ? " (cold)" : ""}: ${r.detail}`);
  for (const r of results.filter((r) => r.verdict === "fixed")) console.log(`cold: known red passes, remove it from ${COLD_REDS}: ${r.id} ${r.cell}`);
  console.log(`cold: ${red.length} red; report ${resolve(out, "cold.md")}`);
  if (red.length) process.exitCode = 1;
}
