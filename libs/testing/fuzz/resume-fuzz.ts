// Resume fuzz (Function Bridge T31, spec §6): drive every interactive element of a story-app route on two pages of the
// same production build — the route loaded as a resumed document (server HTML + resume state) and the same route
// rendered in the browser by a client navigation (CSR: the router mounts the page component) — and compare them after
// every step. Fails on a `rivet:resume-error`, a page error, server nodes the resumed page replaced where the CSR page
// kept them (a component re-run / region re-created), or a DOM mismatch. Dev-only (`@rivetjs/testing/fuzz`).
import { readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Browser, BrowserContext, Page } from "playwright";
import { dropPreloads, installFuzz, type Discovered, type FuzzPage } from "./page.ts";

export type { Discovered } from "./page.ts";

/** One action on a discovered element (index into the route's element list). */
export interface FuzzStep {
  element: number;
  action: "click" | "type" | "press";
  /** Text for `type`, key for `press` (Playwright key names). */
  value?: string;
}

export type FindingKind = "resume-error" | "page-error" | "csr-error" | "mismatch" | "recreated" | "missing" | "load" | "reload";

export interface FuzzFinding {
  route: string;
  kind: FindingKind;
  /** Index of the step after which it was seen (-1: at load). */
  step: number;
  /** Steps run up to and including `step`. */
  steps: FuzzStep[];
  /** Shortest step list found to reproduce it on fresh pages (the failing element's steps alone, when they suffice). */
  repro: FuzzStep[];
  /** Element descriptions by index, for the log. */
  elements: Record<number, string>;
  /** Log text: what differs, with context. */
  detail: string;
  /**
   * Only what differs (pins match against it): attribute tokens per line, the first differing line of each page for a
   * structural difference, the replaced nodes, the error message.
   */
  diff: string;
}

export interface FuzzRouteResult {
  route: string;
  elements: number;
  steps: number;
  findings: FuzzFinding[];
  ms: number;
  /** Step index where a structural difference ended the DOM comparison (-1: at load); later steps check errors / reloads only. */
  compareEnded?: number;
}

export interface FuzzOptions {
  /** Server origin (`http://127.0.0.1:port`). */
  origin: string;
  browser: Browser;
  /** Page the CSR run starts from before navigating client-side to the route (default `/`). */
  from?: string;
  /** Seed for the element sample when the route has more steps than `maxSteps` (default 1; env `RIVET_FUZZ_SEED`). */
  seed?: number;
  /** Step cap per route (default 40; env `RIVET_FUZZ_STEPS`). */
  maxSteps?: number;
  /** Text typed into text inputs (default `"Rivet 7"`). */
  text?: string;
  viewport?: { width: number; height: number };
  /** Find a shorter reproduction for each stopping finding (default true). */
  minimize?: boolean;
  /** Elements to leave alone (CSS selectors, matched on the resumed page at discovery). */
  skip?: string[];
}

/** Story routes of a file-routes directory: `index` → `/`, `a/b.tsx` → `/a/b`; layouts, `*.server.ts`, dynamic segments left out. */
export function storyRoutes(dir: string | URL, options: { exclude?: (string | RegExp)[] } = {}): string[] {
  const root = typeof dir === "string" ? dir : fileURLToPath(dir);
  const out: string[] = [];
  const walk = (at: string, prefix: string): void => {
    for (const name of readdirSync(at).sort()) {
      const file = at + "/" + name;
      if (statSync(file).isDirectory()) {
        if (!/^[[(_]/.test(name)) walk(file, prefix + "/" + name);
        continue;
      }
      const m = /^([^_[(.][^.]*)\.(tsx|jsx)$/.exec(name);
      if (!m) continue;
      out.push(m[1] === "index" ? prefix || "/" : prefix + "/" + m[1]);
    }
  };
  walk(root.replace(/\/$/, ""), "");
  const exclude = options.exclude ?? [];
  return out.filter((route) => !exclude.some((x) => (typeof x === "string" ? x === route : x.test(route))));
}

/**
 * The routes this run covers: `RIVET_FUZZ_ROUTES` (comma-separated substrings or `/regex/`) filters, `RIVET_FUZZ_SHARD=i/n`
 * (1-based) keeps every n-th route starting at i.
 */
export function selectRoutes(routes: string[], env: Record<string, string | undefined> = process.env): string[] {
  let out = routes;
  const filter = env.RIVET_FUZZ_ROUTES?.trim();
  if (filter) {
    const parts = filter
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    out = out.filter((route) =>
      parts.some((p) => (p.startsWith("/") && p.endsWith("/") && p.length > 2 ? new RegExp(p.slice(1, -1)).test(route) : route === p || route.includes(p))),
    );
  }
  const shard = /^(\d+)\/(\d+)$/.exec(env.RIVET_FUZZ_SHARD?.trim() ?? "");
  if (shard) {
    const [i, n] = [Number(shard[1]), Number(shard[2])];
    out = out.filter((_, k) => k % n === i - 1);
  }
  return out;
}

/** The step plan for discovered elements: click (focuses it), type into text inputs, then its keys, then Escape. */
export function plan(elements: Discovered[], options: { maxSteps?: number; seed?: number; text?: string } = {}): FuzzStep[] {
  const max = options.maxSteps ?? 40;
  const text = options.text ?? "Rivet 7";
  const groups = elements.map((el, element) => {
    const steps: FuzzStep[] = [{ element, action: "click" }];
    if (el.kind === "text") steps.push({ element, action: "type", value: text });
    for (const key of el.keys) steps.push({ element, action: "press", value: key });
    if (!el.keys.includes("Escape")) steps.push({ element, action: "press", value: "Escape" });
    return steps;
  });
  if (groups.reduce((n, g) => n + g.length, 0) <= max) return groups.flat();
  // Over the cap: a seeded sample of whole element groups, kept in document order.
  const order = shuffle(
    groups.map((_, i) => i),
    options.seed ?? 1,
  );
  const picked: number[] = [];
  let count = 0;
  for (const i of order) {
    if (count + groups[i]!.length > max) continue;
    picked.push(i);
    count += groups[i]!.length;
  }
  return picked.sort((a, b) => a - b).flatMap((i) => groups[i]!);
}

function shuffle<T>(items: T[], seed: number): T[] {
  // mulberry32
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Fuzz one route: discover, plan, run; each stopping finding gets a shorter reproduction when one exists. */
export async function fuzzRoute(route: string, options: FuzzOptions): Promise<FuzzRouteResult> {
  const started = performance.now();
  const maxSteps = options.maxSteps ?? (Number(process.env.RIVET_FUZZ_STEPS) || 40);
  const seed = options.seed ?? (Number(process.env.RIVET_FUZZ_SEED) || 1);
  let discovered: Discovered[] = [];
  const result = await run(route, options, (found) => {
    discovered = found;
    return plan(found, { maxSteps, seed, text: options.text });
  });
  if (options.minimize !== false)
    for (const finding of result.findings) {
      if (finding.step < 0 || finding.kind === "recreated") continue;
      const element = finding.steps[finding.step]!.element;
      const alone = finding.steps.filter((s) => s.element === element);
      if (alone.length === finding.steps.length) continue;
      const again = await run(route, options, () => alone);
      if (again.findings.some((f) => f.kind === finding.kind)) finding.repro = alone;
    }
  return {
    route,
    elements: discovered.length,
    steps: result.steps,
    findings: result.findings,
    ms: Math.round(performance.now() - started),
    ...(result.compareEnded === undefined ? {} : { compareEnded: result.compareEnded }),
  };
}

interface Side {
  context: BrowserContext;
  page: Page;
  /** Requests in flight → start time (long-lived ones stop counting after `STALE` ms). */
  inflight: Map<object, number>;
}
const STALE = 1500;

// A document marker: gone after a document load (reload, navigation away).
const mark = (page: Page): Promise<void> => page.evaluate(() => void ((window as unknown as { __rivetFuzzDoc?: 1 }).__rivetFuzzDoc = 1));
const sameDocument = (page: Page): Promise<boolean> =>
  page.evaluate(() => (window as unknown as { __rivetFuzzDoc?: 1 }).__rivetFuzzDoc === 1).catch(() => false);

/** Call `window.__rivetFuzz[name](arg)` (a CDP call: page CSPs do not apply). */
const call = <K extends keyof FuzzPage>(
  page: Page,
  name: K,
  arg?: unknown,
): Promise<FuzzPage[K] extends (...a: never[]) => infer R ? Awaited<R> : FuzzPage[K]> =>
  page.evaluate(
    ([name, arg]) => {
      const api = (window as unknown as { __rivetFuzz: Record<string, unknown> }).__rivetFuzz;
      const member = api[name as string];
      return typeof member === "function" ? (member as (a: unknown) => unknown)(arg) : member;
    },
    [name, arg] as const,
  ) as never;

async function open(options: FuzzOptions, resumed: boolean): Promise<Side> {
  const context = await options.browser.newContext({ viewport: options.viewport ?? { width: 1280, height: 800 }, reducedMotion: "reduce" });
  await context.addInitScript(installFuzz);
  // Deterministic cold state on the resumed page: handler chunks load on their events only (no background preloads).
  if (resumed) await context.addInitScript(dropPreloads);
  const page = await context.newPage();
  const side: Side = { context, page, inflight: new Map() };
  const tracked = (type: string) => type !== "websocket" && type !== "eventsource";
  page.on("request", (r) => tracked(r.resourceType()) && side.inflight.set(r, Date.now()));
  page.on("requestfinished", (r) => side.inflight.delete(r));
  page.on("requestfailed", (r) => side.inflight.delete(r));
  return side;
}

/** Wait until no request is in flight and two frames passed, twice in a row (cap `max` ms). */
async function settle(side: Side, min = 60, max = 4000): Promise<void> {
  const end = Date.now() + max;
  await side.page.waitForTimeout(min);
  let quiet = 0;
  while (Date.now() < end && quiet < 2) {
    await side.page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 30)))));
    const now = Date.now();
    quiet = [...side.inflight.values()].every((at) => now - at > STALE) ? quiet + 1 : 0;
  }
}

/**
 * Attribute-only differences of two equally long line lists: `[index, resumed line, csr line]` per differing line, or
 * null when a line differs in tag, depth or text (a structural difference).
 */
export function attributeDiff(a: string[], b: string[]): [number, string, string][] | null {
  if (a.length !== b.length) return null;
  const out: [number, string, string][] = [];
  const head = (line: string) => /^(\s*<[\w:-]+)[ >]/.exec(line)?.[1];
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    const ha = head(a[i]!);
    if (!ha || ha !== head(b[i]!)) return null;
    out.push([i, a[i]!, b[i]!]);
  }
  return out;
}

/** `name="value"` tokens of a line present on one side only. */
const only = (line: string, other: string): string[] => {
  const tokens = (text: string) =>
    new Set(
      text
        .replace(/^\s*<[\w:-]+\s?/, "")
        .replace(/>$/, "")
        .match(/:?[\w:.-]+(?:="(?:[^"\\]|\\.)*"|=\w+)?/g) ?? [],
    );
  const theirs = tokens(other);
  return [...tokens(line)].filter((t) => !theirs.has(t));
};

/** Attribute differences as one line each: `<tag>`: resumed-only / csr-only tokens. */
export function describeAttributeDiff(list: [number, string, string][]): string {
  return list
    .slice(0, 6)
    .map(([i, a, b]) => {
      const tag = /<([\w:-]+)/.exec(a)?.[1];
      const id = / id="([^"]+)"/.exec(a)?.[1];
      return `line ${i + 1} <${tag}${id ? "#" + id : ""}>: resumed only [${only(a, b).join(" ")}] / csr only [${only(b, a).join(" ")}]`;
    })
    .concat(list.length > 6 ? [`… ${list.length - 6} more`] : [])
    .join("\n");
}

const LINE = /^(\s*<[\w:-]+)(.*)>$/;
const TOKEN = /:?[\w:.-]+(?:="(?:[^"\\]|\\.)*"|=\w+)?/g;
/** An element line's head (`  <tag`) and attribute tokens (`name="value"`, `:focus`, `:checked=true`); null for a text line. */
const tokensOf = (line: string): { head: string; list: string[] } | null => {
  const m = LINE.exec(line);
  return m ? { head: m[1]!, list: m[2]!.match(TOKEN) ?? [] } : null;
};
const nameOf = (token: string): string => /^:?[\w:.-]+/.exec(token)![0];
/** A tolerated difference: attribute name, its token on the resumed line, on the CSR line (null: absent). */
export type Rule = [name: string, resumed: string | null, csr: string | null];
export interface Snap {
  lines: string[];
  keys: number[];
}

/** Lines with tolerated triples removed: a token pair is dropped only while both lines still carry exactly those tokens. */
export function applyRules(rules: Map<number, Rule[]>, r: Snap, c: Snap): [string[], string[]] {
  const a = r.lines.slice(),
    b = c.lines.slice();
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const k = r.keys[i];
    const list = k && k === c.keys[i] ? rules.get(k) : undefined;
    if (!list) continue;
    const ta = tokensOf(a[i]!),
      tb = tokensOf(b[i]!);
    if (!ta || !tb || ta.head !== tb.head) continue;
    const token = (t: { list: string[] }, name: string) => t.list.find((x) => nameOf(x) === name) ?? null;
    const drop = new Set(list.filter(([name, rv, cv]) => token(ta, name) === rv && token(tb, name) === cv).map(([name]) => name));
    if (!drop.size) continue;
    const build = (t: { head: string; list: string[] }) =>
      t.head +
      t.list
        .filter((x) => !drop.has(nameOf(x)))
        .map((x) => " " + x)
        .join("") +
      ">";
    a[i] = build(ta);
    b[i] = build(tb);
  }
  return [a, b];
}

/** The first differing line of each list (pins match structural differences against it, not the context). */
export function structuralDiff(a: string[], b: string[]): string {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return `resumed: ${a[i]?.trim() ?? "(end)"}\ncsr: ${b[i]?.trim() ?? "(end)"}`;
}

/** First differing region of two line lists (± 3 lines of context). */
export function diffLines(a: string[], b: string[]): string {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (i === a.length && i === b.length) return "";
  const from = Math.max(0, i - 3);
  const show = (lines: string[]) =>
    lines
      .slice(from, i + 4)
      .map((line, k) => (from + k === i ? "> " : "  ") + line)
      .join("\n");
  return `line ${i + 1} (resumed ${a.length} lines, csr ${b.length}):\n--- resumed\n${show(a)}\n--- csr\n${show(b)}`;
}

async function run(
  route: string,
  options: FuzzOptions,
  makePlan: (found: Discovered[]) => FuzzStep[],
): Promise<{ steps: number; findings: FuzzFinding[]; compareEnded?: number }> {
  const findings: FuzzFinding[] = [];
  const elements: Record<number, string> = {};
  let steps: FuzzStep[] = [];
  const report = (kind: FindingKind, step: number, detail: string, diff = detail) =>
    findings.push({ route, kind, step, steps: steps.slice(0, step + 1), repro: steps.slice(0, step + 1), elements: { ...elements }, detail, diff });
  let compareEnded: number | undefined;
  const r = await open(options, true);
  const c = await open(options, false);
  try {
    // Resumed: the route as a document load. CSR: the start page, then a client navigation to the route.
    await r.page.goto(options.origin + route);
    await c.page.goto(options.origin + (options.from ?? "/"));
    await Promise.all([settle(r, 300), settle(c, 300)]);
    await Promise.all([mark(r.page), mark(c.page)]);
    const before = await call(c.page, "bodyChildren");
    // A trusted click on a link (the router takes link clicks through its delegated `click` clientEvent).
    await c.page.evaluate((href) => {
      const a = document.createElement("a");
      a.href = href;
      a.id = "rivet-fuzz-nav";
      a.textContent = "fuzz";
      a.style.cssText = "position:fixed;left:0;top:0;z-index:2147483647;padding:4px;background:#fff";
      document.body.append(a);
    }, route);
    await c.page.click("#rivet-fuzz-nav");
    // Removed only once the router took it: a cold click is held while the router chunk loads, then replayed on the link.
    await c.page.waitForFunction((path) => location.pathname === path, route, { timeout: 10_000 }).catch(() => {});
    await settle(c, 300);
    await c.page.evaluate(() => document.getElementById("rivet-fuzz-nav")?.remove());
    if (!(await sameDocument(c.page)) || new URL(c.page.url()).pathname !== route) {
      report("load", -1, `the client navigation to ${route} did not render in place (a document load, or at ${c.page.url()})`);
      return { steps: 0, findings };
    }
    // The router focuses the new page's first h1 after it settles (`tabindex="-1"`): wait for that, then undo it.
    await c.page
      .waitForFunction(() => document.activeElement === (document.querySelector("h1") ?? document.querySelector("main")), undefined, { timeout: 2000 })
      .catch(() => {});
    await call(c.page, "afterNavigation", before);
    // Same pointer position on both pages (the CSR page's mouse sits where the navigation link was).
    const { width, height } = options.viewport ?? { width: 1280, height: 800 };
    await Promise.all([r.page.mouse.move(width - 1, height - 1), c.page.mouse.move(width - 1, height - 1)]);
    await Promise.all([settle(r), settle(c)]);
    const errors = async (side: Side, seen: number): Promise<string[]> => (await call(side.page, "errors")).slice(seen);
    let seenR = 0,
      seenC = 0;
    const checkErrors = async (step: number): Promise<void> => {
      const er = await errors(r, seenR);
      const ec = await errors(c, seenC);
      seenR += er.length;
      seenC += ec.length;
      for (const e of er) report(e.startsWith("rivet:resume-error") ? "resume-error" : "page-error", step, e);
      for (const e of ec) report("csr-error", step, e);
    };
    await checkErrors(-1);
    // Tolerated attribute differences: exact (name, resumed token, CSR token) triples per element key. A later different
    // value on either page (or the same value on both) is compared again.
    const rules = new Map<number, Rule[]>();
    let nextKey = 1;
    let raw: [Snap, Snap] = [
      { lines: [], keys: [] },
      { lines: [], keys: [] },
    ];
    let snapshots: [string[], string[]] = [[], []];
    const compare = async (): Promise<string> => {
      raw = await Promise.all([call(r.page, "snapshot"), call(c.page, "snapshot")]);
      snapshots = applyRules(rules, ...raw);
      return diffLines(...snapshots);
    };
    // A difference only in attributes is reported once and that triple tolerated afterwards (the fuzz goes on); a
    // structural one (tags, text, line count) ends the DOM comparison (later steps still check errors and reloads).
    const tolerate = async (kind: FindingKind, step: number, prefix: string, diff: string): Promise<boolean> => {
      const attrs = attributeDiff(...snapshots);
      if (!attrs) {
        report(kind, step, prefix + diff, structuralDiff(...snapshots));
        compareEnded = step;
        return false;
      }
      const text = describeAttributeDiff(attrs);
      report(kind, step, prefix + text, text);
      const assign: [number, number][] = [];
      for (const [i, a, b] of attrs) {
        let k = raw[0].keys[i]!;
        if (!k || k !== raw[1].keys[i]) assign.push([i, (k = nextKey++)]);
        const ta = tokensOf(a)!,
          tb = tokensOf(b)!;
        const list = rules.get(k) ?? [];
        for (const name of new Set([...ta.list, ...tb.list].map(nameOf))) {
          const x = ta.list.find((t) => nameOf(t) === name) ?? null,
            y = tb.list.find((t) => nameOf(t) === name) ?? null;
          if (x !== y) list.push([name, x, y]);
        }
        rules.set(k, list);
      }
      if (assign.length) await Promise.all([call(r.page, "key", assign), call(c.page, "key", assign)]);
      return true;
    };
    const initial = await compare();
    let comparing = !initial || (await tolerate("load", -1, "resumed and CSR renders differ before any interaction: ", initial));
    const found = await call(r.page, "discover", options.skip ?? []);
    steps = makePlan(found);
    const paths = found.map((el) => el.path);
    const [boundR, boundC] = await Promise.all([call(r.page, "bind", paths), call(c.page, "bind", paths)]);
    if (comparing && boundR !== boundC) report("missing", -1, `elements resolved: resumed ${boundR}, csr ${boundC}`);
    for (const i of new Set(steps.map((s) => s.element))) elements[i] = await call(r.page, "describe", i);
    await Promise.all([call(r.page, "stamp"), call(c.page, "stamp")]);
    let reported = new Set<number>();
    for (let k = 0; k < steps.length; k++) {
      const step = steps[k]!;
      const outcome = await Promise.all([act(r, step), act(c, step)]);
      if (comparing && outcome[0] !== outcome[1]) {
        report("missing", k, `step ${describeStep(step)}: resumed ${outcome[0]}, csr ${outcome[1]}`);
        break;
      }
      await Promise.all([settle(r), settle(c)]);
      await checkErrors(k);
      const [stayR, stayC] = await Promise.all([sameDocument(r.page), sameDocument(c.page)]);
      if (!stayR || !stayC) {
        // A step that leaves the page on both sides (a link, a form submit) ends the route; on one side only: a finding.
        if (stayR !== stayC) report("reload", k, `${stayR ? "the CSR" : "the resumed"} page loaded another document after ${describeStep(step)}`);
        break;
      }
      if (!comparing) {
        // DOM comparison ended (structural difference): the rest of the route still checks errors and reloads.
        const [urlR, urlC] = [r.page.url(), c.page.url()];
        if (urlR === urlC && new URL(urlR).pathname !== route) break;
        continue;
      }
      // Re-created server nodes: removed on the resumed page, kept on the CSR page (same stamp index = same node).
      const [goneR, goneC] = await Promise.all([call(r.page, "removed"), call(c.page, "removed")]);
      const kept = new Set(goneC);
      const only = goneR.filter((i) => !kept.has(i) && !reported.has(i));
      if (only.length) {
        const tags = await call(r.page, "describeStamps", only.slice(0, 5));
        const list = `${tags.join(", ")}${only.length > 5 ? ", …" : ""}`;
        report("recreated", k, `${only.length} server node(s) replaced on the resumed page, kept by CSR: ${list}`, list);
        reported = new Set([...reported, ...goneR]);
      }
      const [urlR, urlC] = await Promise.all([r.page.url(), c.page.url()]);
      if (urlR === urlC && new URL(urlR).pathname !== route) break; // both navigated away (a link): the route is done
      let diff = await compare();
      if (diff) {
        // Timers / transitions finishing a little later on one side: one more settle before calling it a mismatch.
        await Promise.all([settle(r, 400), settle(c, 400)]);
        diff = await compare();
      }
      if (diff) comparing = await tolerate("mismatch", k, `after ${describeStep(step)}: `, diff);
    }
    return { steps: steps.length, findings, ...(compareEnded === undefined ? {} : { compareEnded }) };
  } finally {
    await r.context.close();
    await c.context.close();
  }
}

/** Perform `step` on one side: "done", or "gone" (element no longer in the document / not actionable). */
async function act(side: Side, step: FuzzStep): Promise<"done" | "gone"> {
  const { page } = side;
  if (step.action === "press") {
    await page.keyboard.press(step.value!);
    return "done";
  }
  if (step.action === "type") {
    await page.keyboard.type(step.value!);
    return "done";
  }
  const handle = (await page.evaluateHandle((i) => (window as unknown as { __rivetFuzz: FuzzPage }).__rivetFuzz.element(i), step.element)).asElement();
  if (!handle) return "gone";
  try {
    await handle.click({ timeout: 1000 });
    return "done";
  } catch {
    return "gone";
  } finally {
    await handle.dispose();
  }
}

const describeStep = (step: FuzzStep): string => `#${step.element} ${step.action}${step.value === undefined ? "" : " " + JSON.stringify(step.value)}`;

/** The shell command that re-runs one route of a fuzz project (exact route match; current seed / step cap kept). */
export function rerunCommand(route: string, project: string, env: Record<string, string | undefined> = process.env): string {
  const exact = route.replace(/[.*+?^$|()[\]{}\\/]/g, "\\$&");
  const vars = ["RIVET_FUZZ_ROUTES='/^" + exact + "$/'"];
  for (const name of ["RIVET_FUZZ_SEED", "RIVET_FUZZ_STEPS"]) if (env[name]) vars.push(`${name}=${env[name]}`);
  return `${vars.join(" ")} npx vitest run --project ${project} --maxWorkers=1`;
}

/** A finding as a repro log: route, kind, element, steps (+ the command that re-runs the route, when `project` is given). */
export function formatFinding(finding: FuzzFinding, project?: string): string {
  return [
    `${finding.route} — ${finding.kind}${finding.step >= 0 ? " at step " + (finding.step + 1) : " at load"}`,
    finding.detail,
    ...(finding.repro.length
      ? ["repro (" + finding.repro.length + " steps):", ...finding.repro.map((s, k) => `  ${k + 1}. ${describeStep(s)}  ${finding.elements[s.element] ?? ""}`)]
      : []),
    ...(project ? ["rerun: " + rerunCommand(finding.route, project)] : []),
  ].join("\n");
}
