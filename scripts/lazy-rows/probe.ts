// Lazy collection rows probe (spec docs/design/specs/2026-10-19-lazy-collection-rows-design.md T1; the T6 gate
// instrument). Builds docs example frame pages (docs-kit `buildFrames`: the `check-examples` build, frames only,
// prerendered), serves them like `check-examples` does, and prints per page:
//   - HTML bytes (raw / brotli) and `rivet/state` bytes (raw / brotli), split per keyed `For` group (docs-kit
//     `tools/rows.ts`: rows, share raw / brotli, `saved` = what the state's brotli loses without the share);
//   - server CPU per render: the build's request handler in this process, `warmup` renders, then the median of `runs`
//     (process CPU time, user + system, and wall time);
//   - click-to-interactive of the first row (Playwright Chromium, the one the vitest browser projects use): fresh
//     context per load, page quiet, mouse click on the row's centre, time until the row shows the click (selected /
//     checked / current / pressed state, or focus inside it), next frame painted; a click that changes nothing within
//     `CLICK_RETRY_MS` is repeated (create + swap pages lose the first one) and counted; median over `loads` loads, at
//     each `--cpu` rate (CDP CPU throttling). Pages whose rows take no clicks have an `ACTIONS` entry instead (a key in
//     the filter input, time until the watched count text changes).
// Environment (Node, Chromium, CPU model, cores, load average, `RIVET_LAZY_ROWS`) is printed with the numbers.
//
// Usage: node scripts/lazy-rows/probe.ts [<app>:<id> | <id> …] [--app apps/ui-docs] [--json] [--runs 20] [--warmup 5]
//          [--loads 5] [--cpu 1,4] [--no-build] [--dist <dir>] [--click <selector>]
// Default pages: `DEFAULT_PAGES`. `RIVET_LAZY_ROWS=on` probes lazy rows (the build children get `resume.lazyRows`:
// `@rivetjs/router` `lazyRowsBuild`, LAZY-T5B; pass `--dist` to keep it apart from the `off` build).
// `RIVET_LAZY_ROWS=swap` probes the swap interim (`@rivetjs/router` `build/lazy-rows.ts`);
// its default dist is `<app>/.artifacts/lazy-rows-probe-swap` (else `…/lazy-rows-probe`).
import { readFile } from "node:fs/promises";
import { cpus, loadavg, platform, release } from "node:os";
import { resolve } from "node:path";
import { brotliCompressSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { buildFrames, type FramesBuild } from "../../libs/docs-kit/tools/check-examples.ts";
import { CHROMIUM_ARGS, serveClient } from "../../libs/docs-kit/tools/example-checks.ts";
import { pageRows, rowFacts } from "../../libs/docs-kit/tools/rows.ts";
import { framePath, framePreload } from "../../libs/docs-kit/frame-theme.ts";
import { loadBuild } from "../../libs/router/adapters/build.ts";
import { loadApp } from "../../libs/docs-kit/tools/app.ts";
import { PROBE_VERSION, type ProbePage, type ProbeReport } from "./schema.ts";
import { median } from "../bench/shared.ts";

const repo = resolve(import.meta.dirname, "../..");
/**
 * Default pages (judgement call, LAZY-T1 report): the two pages spec §1 measures (ui-docs `table-virtualization`,
 * `list-box-virtualization`: virtualized since COLLECTION-VIRT, so they show the per-row cost of the rendered window),
 * the cdk-docs `virtualizer-items` filter page (§3.2 item 6) and a non-virtualized cdk Table with selection
 * (ui-docs `table-selection`: every row rendered, the select-all loss budget of §4 / R5).
 */
export const DEFAULT_PAGES = [
  "apps/ui-docs:table-virtualization",
  "apps/ui-docs:list-box-virtualization",
  "apps/cdk-docs:virtualizer-items",
  "apps/ui-docs:table-selection",
];
/** First row of a collection: the selectors tried in order (`--click` overrides); body rows carry `data-key`, header rows do not. */
const ROW_SELECTORS = ["[role=row][data-key]", "[role=option]", "[role=treeitem]", "[role=menuitem]", "[role=listitem]", "li"];
const CLICK_RETRY_MS = 1000;
const CLICK_MAX = 3;

interface Options {
  pages: { app: string; id: string }[];
  json: boolean;
  runs: number;
  warmup: number;
  loads: number;
  cpu: number[];
  build: boolean;
  dist?: string;
  click?: string;
}

function parse(args: readonly string[]): Options {
  const options: Options = { pages: [], json: false, runs: 20, warmup: 5, loads: 5, cpu: [1, 4], build: true };
  let app = "apps/ui-docs";
  const ids: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    const value = () => {
      const next = args[++i];
      if (next === undefined) throw new Error(`${arg} needs a value`);
      return next;
    };
    if (arg === "--json") options.json = true;
    else if (arg === "--runs") options.runs = Math.max(1, +value());
    else if (arg === "--warmup") options.warmup = Math.max(0, +value());
    else if (arg === "--loads") options.loads = Math.max(1, +value());
    else if (arg === "--cpu")
      options.cpu = value()
        .split(",")
        .map(Number)
        .filter((n) => n >= 1);
    else if (arg === "--no-build") options.build = false;
    else if (arg === "--dist") options.dist = value();
    else if (arg === "--click") options.click = value();
    else if (arg === "--app") app = value();
    else if (arg.startsWith("--")) throw new Error(`unknown option ${arg}`);
    else ids.push(...arg.split(",").filter(Boolean));
  }
  for (const id of ids.length ? ids : DEFAULT_PAGES) {
    const colon = id.indexOf(":");
    options.pages.push(colon < 0 ? { app, id } : { app: id.slice(0, colon), id: id.slice(colon + 1) });
  }
  return options;
}

const round = (n: number, digits = 3) => Math.round(n * 10 ** digits) / 10 ** digits;

/** Server CPU / wall per render of one frame page (the build's handler, this process). */
async function serverRender(frames: { handler: (request: Request) => Promise<Response> | Response }, url: string, warmup: number, runs: number) {
  const once = async () => {
    const wall = performance.now();
    const cpu = process.cpuUsage();
    const response = await frames.handler(new Request(url));
    if (response.status !== 200) throw new Error(`${url}: ${response.status}`);
    await response.text();
    const used = process.cpuUsage(cpu);
    return { cpu: (used.user + used.system) / 1000, wall: performance.now() - wall };
  };
  for (let i = 0; i < warmup; i++) await once();
  const samples: { cpu: number; wall: number }[] = [];
  for (let i = 0; i < runs; i++) samples.push(await once());
  return { cpuMs: round(median(samples.map((s) => s.cpu))), wallMs: round(median(samples.map((s) => s.wall))), runs };
}

type Browser = import("playwright").Browser;

/**
 * The first interaction a page is measured with: a click on its first row (default), or a key pressed in an input
 * whose effect shows in `watch` (text) — filter pages, whose rows take no clicks.
 */
export type Action = { kind: "click"; selector?: string } | { kind: "key"; input: string; key: string; watch: string };
/** Per-page actions of the default pages that are no row click. */
export const ACTIONS: Record<string, Action> = {
  "virtualizer-items": { kind: "key", input: "#products-filter", key: "1", watch: "#products-count" },
};

/** One cold load + the action; ms from the first input event to the painted response, or null (no response). */
async function interactOnce(
  browser: Browser,
  url: string,
  rate: number,
  action: Action,
): Promise<{ ms: number | null; clicks: number; selector: string | null }> {
  const context = await browser.newContext({ viewport: { width: 1000, height: 800 } });
  const page = await context.newPage();
  try {
    if (rate > 1) {
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate });
    }
    await page.goto(url, { waitUntil: "load" });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(300);
    const found = await page.evaluate(
      ([selectors, watch]) => {
        for (const s of selectors) {
          const el = document.querySelector<HTMLElement>(`[data-rivet-frame] ${s}`) ?? document.querySelector<HTMLElement>(s);
          if (el && el.getBoundingClientRect().height > 0) {
            el.setAttribute("data-probe-row", "");
            if (watch) document.querySelector(watch)?.setAttribute("data-probe-watch", "");
            return s;
          }
        }
        return null;
      },
      [action.kind === "key" ? [action.input] : action.selector ? [action.selector] : ROW_SELECTORS, action.kind === "key" ? action.watch : null] as const,
    );
    if (!found) return { ms: null, clicks: 0, selector: null };
    const box = await page.locator("[data-probe-row]").first().boundingBox();
    if (!box) return { ms: null, clicks: 0, selector: found };
    // What the user sees: the row's state (by key: a re-created row is a new element) or the watched text.
    await page.evaluate((kind) => {
      const row = document.querySelector<HTMLElement>("[data-probe-row]")!;
      const watch = document.querySelector("[data-probe-watch]");
      const key = row.getAttribute("data-key") ?? row.closest("[data-key]")?.getAttribute("data-key") ?? null;
      const shown = () => {
        if (kind === "key") return (watch?.isConnected ? watch : document.querySelector("[data-probe-watch]"))?.textContent ?? "";
        const now = (key !== null ? document.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`) : null) ?? row;
        const state = ["aria-selected", "aria-checked", "aria-current", "aria-pressed", "data-selected", "data-pressed"]
          .map((name) => now.getAttribute(name) ?? now.querySelector(`[${name}]`)?.getAttribute(name) ?? "")
          .join("|");
        return state + "|" + (now.contains(document.activeElement) ? "focus" : "");
      };
      const before = shown();
      const w = window as unknown as { __probe: { t0: number; t1: number } };
      w.__probe = { t0: 0, t1: 0 };
      addEventListener(kind === "key" ? "keydown" : "pointerdown", () => w.__probe.t0 || (w.__probe.t0 = performance.now()), { capture: true });
      const poll = () => {
        if (w.__probe.t0 && shown() !== before) {
          const at = performance.now();
          // Painted: the frame after the change.
          requestAnimationFrame(() => setTimeout(() => (w.__probe.t1 = Math.max(at, performance.now())), 0));
          return;
        }
        requestAnimationFrame(poll);
      };
      requestAnimationFrame(poll);
    }, action.kind);
    if (action.kind === "key") await page.focus("[data-probe-row]");
    let clicks = 0;
    for (; clicks < CLICK_MAX;) {
      clicks++;
      if (action.kind === "key") await page.keyboard.press(action.key);
      else await page.mouse.click(box.x + box.width / 2, box.y + Math.min(box.height / 2, 12));
      const done = await page
        .waitForFunction(() => (window as unknown as { __probe: { t1: number } }).__probe.t1 > 0, undefined, { timeout: CLICK_RETRY_MS * rate })
        .then(
          () => true,
          () => false,
        );
      if (done) break;
    }
    const probe = await page.evaluate(() => (window as unknown as { __probe: { t0: number; t1: number } }).__probe);
    return { ms: probe.t1 ? round(probe.t1 - probe.t0, 1) : null, clicks, selector: action.kind === "key" ? `${found} key ${action.key}` : found };
  } finally {
    await context.close();
  }
}

function environment(options: Options, chromium: string) {
  let commit = process.env.RIVET_PROBE_COMMIT ?? "";
  if (!commit)
    try {
      commit = execFileSync("git", ["-C", repo, "rev-parse", "--short", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch {
      commit = "unknown";
    }
  return {
    date: new Date().toISOString(),
    commit,
    node: process.version,
    chromium,
    os: `${platform()} ${release()}`,
    cpu: cpus()[0]?.model ?? "?",
    cores: cpus().length,
    load: loadavg().map((n) => round(n, 2)),
    lazyRows: process.env.RIVET_LAZY_ROWS === "swap" ? ("swap" as const) : null,
    runs: options.runs,
    warmup: options.warmup,
    loads: options.loads,
    cpuRates: options.cpu,
  };
}

const kb = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`);

/** Text table of a report (the non-`--json` output). */
export function formatReport(report: ProbeReport): string {
  const env = report.env;
  const lines = [
    `lazy-rows probe v${report.version} ${env.date} commit ${env.commit}${env.lazyRows ? ` RIVET_LAZY_ROWS=${env.lazyRows}` : ""}`,
    `node ${env.node}, chromium ${env.chromium}, ${env.os}, ${env.cpu} ×${env.cores}, load ${env.load.join(" ")}; server: ${env.warmup} warm-up + median of ${env.runs}; click: median of ${env.loads} loads at CPU ×${env.cpuRates.join(" / ×")}`,
    "",
    "| page | HTML raw / br | state raw / br | server CPU / wall per render | first interaction | rows |",
    "| --- | ---: | ---: | ---: | ---: | --- |",
  ];
  for (const p of report.pages) {
    const click = p.click
      .map((c) => `×${c.cpu}: ${c.ms === null ? "–" : c.ms + " ms"}${c.clicks > c.loads ? ` (${c.clicks} clicks / ${c.loads} loads)` : ""}`)
      .join(", ");
    const rows = p.fors.length
      ? p.fors
          .map(
            (f) =>
              `${"+".repeat(f.depth)}${f.mode}${f.reason ? ` (${f.reason})` : ""} ${f.symbol.replace(/^.*\//, "")} ×${f.rows}: ${kb(f.raw)} / ${kb(f.brotli)} br (saved ${kb(f.saved ?? 0)} br)`,
          )
          .join("; ")
      : "-";
    lines.push(
      `| ${p.app.replace(/^apps\//, "")}:${p.id} | ${kb(p.html.raw)} / ${kb(p.html.brotli)} | ${kb(p.state.raw)} / ${kb(p.state.brotli)} | ${p.server.cpuMs} / ${p.server.wallMs} ms | ${click} | ${rows} |`,
    );
  }
  return lines.join("\n");
}

async function main(): Promise<void> {
  const options = parse(process.argv.slice(2));
  // Progress on stderr: stdout is the report (`--json` = JSON only).
  const log = (message: string) => console.error(message);
  const byApp = new Map<string, string[]>();
  for (const { app, id } of options.pages) (byApp.get(app) ?? byApp.set(app, []).get(app)!).push(id);
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true, args: CHROMIUM_ARGS });
  const pages: ProbePage[] = [];
  try {
    for (const [app, ids] of byApp) {
      const root = resolve(repo, app);
      const dist = resolve(
        options.dist
          ? resolve(options.dist, app.replace(/\W+/g, "-"))
          : resolve(root, `.artifacts/lazy-rows-probe${process.env.RIVET_LAZY_ROWS ? "-swap" : ""}`),
      );
      let build: FramesBuild["build"];
      let origin: string;
      if (options.build) {
        const frames = await buildFrames(root, ids, { dist, log });
        build = frames.build;
        origin = frames.origin;
      } else {
        build = await loadBuild(dist, { preload: framePreload });
        origin = (await loadApp(root)).site.origin;
      }
      const server = await serveClient(build.client);
      const facts = await rowFacts(root);
      try {
        for (const id of ids) {
          const html = await readFile(resolve(build.client, "." + framePath(id), "index.html"), "utf8");
          const rows = pageRows(html, { saved: true, facts });
          log(`probe: ${app}:${id} server renders`);
          const render = await serverRender(build, origin + framePath(id), options.warmup, options.runs);
          const click: ProbePage["click"] = [];
          for (const rate of options.cpu) {
            log(`probe: ${app}:${id} clicks at CPU ×${rate}`);
            const samples: { ms: number | null; clicks: number; selector: string | null }[] = [];
            for (let i = 0; i < options.loads; i++)
              samples.push(
                await interactOnce(
                  browser,
                  server.url + framePath(id),
                  rate,
                  options.click ? { kind: "click", selector: options.click } : (ACTIONS[id] ?? { kind: "click" }),
                ),
              );
            const times = samples.map((s) => s.ms).filter((ms): ms is number => ms !== null);
            click.push({
              cpu: rate,
              ms: times.length ? round(median(times), 1) : null,
              samples: samples.map((s) => s.ms),
              loads: samples.length,
              clicks: samples.reduce((sum, s) => sum + s.clicks, 0),
              selector: samples.find((s) => s.selector)?.selector ?? null,
            });
          }
          pages.push({
            app,
            id,
            html: { raw: Buffer.byteLength(html), brotli: brotliCompressSync(Buffer.from(html)).length },
            state: rows ? { raw: rows.state.raw, brotli: rows.state.brotli ?? 0 } : { raw: 0, brotli: 0 },
            fors: rows ? rows.fors : [],
            server: render,
            click,
          });
        }
      } finally {
        await server.close();
      }
    }
    const report: ProbeReport = { version: PROBE_VERSION, env: environment(options, browser.version()), pages };
    console.log(options.json ? JSON.stringify(report, null, 2) : formatReport(report));
  } finally {
    await browser.close();
  }
}

if (import.meta.main) await main();
