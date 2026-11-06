import { chromium, type Page } from "playwright";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { cpus, platform, arch, totalmem, loadavg } from "node:os";
import { createHash } from "node:crypto";
import { startServer } from "./server.ts";
import { fieldRevisions, hostElements, selectFields, summarize, type Summary } from "./metrics.ts";

interface Sample {
  wallMs: number;
  taskCpuMs: number;
  layoutMs: number;
  frameSettleMs: number;
}

const root = dirname(fileURLToPath(import.meta.url));
interface Options {
  rows: number[];
  repeats: number;
  samples: number;
  out: string;
  frameworks: string[] | null;
  /** First lane rotation (repeat r starts at lane (offset + r) % n): rotate lanes across runs split into one-repeat invocations. */
  offset: number;
}
interface Manifest {
  artifacts: { framework: string; sha256: string; inputs: { path: string; sha256: string }[] }[];
}
type Operation = keyof DomBenchOperations;
interface DomBenchOperations {
  mount: [rows: number];
  update: [indices: number[], revision: number];
  dispose: [];
}
const options: Options = { rows: [100, 1000, 5000], repeats: 3, samples: 5, out: ".artifacts/dom-bench/latest", frameworks: null, offset: 0 };
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i]!.replace(/^--/, "") as keyof Options;
  if (!(key in options) || !process.argv[i + 1]) throw Error(`Unknown or missing option ${process.argv[i]}`);
  (options as unknown as Record<string, unknown>)[key] =
    key === "rows"
      ? process.argv[i + 1]!.split(",").map(Number)
      : key === "frameworks"
        ? process.argv[i + 1]!.split(",")
      : key === "out"
        ? process.argv[i + 1]
        : Number(process.argv[i + 1]);
}
if (
  options.rows.some((n) => !Number.isSafeInteger(n) || n < 1) ||
  ![options.repeats, options.samples].every((n) => Number.isSafeInteger(n) && n > 0) ||
  !Number.isSafeInteger(options.offset) ||
  options.offset < 0
)
  throw Error("Counts must be positive integers");
const manifest = JSON.parse(await readFile(resolve(root, "dist/builds.json"), "utf8")) as Manifest;
for (const artifact of manifest.artifacts) {
  const bytes = await readFile(resolve(root, `dist/${artifact.framework}.js`));
  if (createHash("sha256").update(bytes).digest("hex") !== artifact.sha256)
    throw Error("Bundle does not match build manifest");
  for (const input of artifact.inputs) {
    const actual = createHash("sha256")
      .update(await readFile(resolve(root, "../..", input.path)))
      .digest("hex");
    if (actual !== input.sha256) throw Error(`Source changed since build: ${input.path}`);
  }
}
const experimentSources: { path: string; sha256: string }[] = [];
const sourcePaths = [
  "package.json",
  "package-lock.json",
  "apps/bench-stable/package.json",
  "apps/resume-bench/stable-dependencies.ts",
  ...["build.ts", "run.ts", "metrics.ts", "server.ts", "report.ts", "package.json"].map(
    (p) => `apps/dom-bench/${p}`,
  ),
  ...(await readdir(resolve(root, "../../libs/compiler")))
    .filter((p) => p.endsWith(".ts") || p.endsWith(".wasm"))
    .map((p) => `libs/compiler/${p}`),
];
for (const path of sourcePaths)
  experimentSources.push({
    path,
    sha256: createHash("sha256")
      .update(await readFile(resolve(root, "../..", path)))
      .digest("hex"),
  });
const server = await startServer(),
  browser = await chromium.launch();
const trials: Awaited<ReturnType<typeof trial>>[] = [];
const started = new Date().toISOString();
const destination = resolve(options.out);
await mkdir(destination, { recursive: true });

// Protocol nowrap-2026-11-06: page checks create no JS wrapper for page nodes (XPath count() + #host textContent,
// metrics.ts FIELD_TEXT), so every lane's timed updates / dispose and heap see only the wrappers the framework made.
async function validate(page: Page, rows: number, expected: number[]) {
  const { counts, text } = await page.evaluate(() => {
    const host = document.querySelector("#host")!,
      count = (path: string) => document.evaluate(path, host, null, XPathResult.NUMBER_TYPE, null).numberValue;
    return {
      counts: [
        count("count(.//*[@data-row])"),
        count("count(.//*[@data-field])"),
        count("count(.//*)"),
        // Every field's own text starts with its index (exact text + order: `fieldRevisions` below).
        count("count(.//*[@data-field][not(starts-with(., concat('value-', @data-field, '-')))])"),
      ],
      text: host.textContent!,
    };
  });
  if (counts[0] !== rows || counts[1] !== rows * 10 || counts[2] !== hostElements(rows) || counts[3] !== 0) throw Error("Incorrect page size");
  const revisions = fieldRevisions(text);
  if (revisions.length !== rows * 10) throw Error("Incorrect field count");
  revisions.forEach((revision, index) => {
    if (revision !== expected[index]) throw Error(`Incorrect field ${index}`);
  });
}

async function settle(page: Page) {
  return page.evaluate(async () => {
    const begin = performance.now();
    void document.querySelector("#host")!.getBoundingClientRect().height;
    const layoutMs = performance.now() - begin;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return { layoutMs, frameSettleMs: performance.now() - begin };
  });
}

async function trial(framework: string, rows: number, repeat: number) {
  const load1 = loadavg()[0]!;
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.setDefaultTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable", { timeDomain: "threadTicks" });
  const cpu = async () =>
    new Map((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value])).get("TaskDuration")! *
    1000;
  const heap = async () => {
    await cdp.send("HeapProfiler.collectGarbage");
    return (await cdp.send("Runtime.getHeapUsage")).usedSize;
  };
  const timed = async <O extends Operation>(operation: O, args: DomBenchOperations[O]) => {
    const before = await cpu();
    const wallMs = await page.evaluate(
      ({ operation, args }) => {
        const begin = performance.now();
        (window.bench[operation] as (...values: unknown[]) => void)(...args);
        return performance.now() - begin;
      },
      { operation, args },
    );
    return { wallMs, taskCpuMs: (await cpu()) - before };
  };
  try {
    await page.goto(`${server.url}/${framework}`);
    await page.waitForFunction(() => window.bench);
    // Timer resolution guard (B4): the fixture server cross-origin-isolates every page (5 µs timers, not 100 µs).
    if (!(await page.evaluate(() => crossOriginIsolated))) throw new Error(`${framework}: page is not cross-origin isolated (coarse performance.now)`);
    const cycle = () =>
      page.evaluate((rows) => {
        window.bench.mount(rows);
        window.bench.dispose();
      }, rows);
    await cycle();
    await settle(page);
    const baselineHeapBytes = await heap();
    // Mount protocol (2026-10-21, docs/benchmarks/2026-10-20-dom-mount.md "Protocol applied"): the forced GC above leaves a ~1 MiB heap,
    // so V8 would start incremental marking inside a 5000-row mount and pick (or not) its finalization delay from the
    // page's task history. One unforced re-warm cycle grows the heap limits back (no marking cycle starts inside the
    // timed mount on the Rivet / Solid lanes), then one macrotask before the timed mount.
    await cycle();
    await settle(page);
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
    const mount = await timed("mount", [rows]);
    const mountSettle = await settle(page);
    const expected: number[] = Array(rows * 10).fill(0);
    await validate(page, rows, expected);
    const size = await page.evaluate(() => {
      const host = document.querySelector("#host")!,
        count = (path: string) => document.evaluate(path, host, null, XPathResult.NUMBER_TYPE, null).numberValue;
      return {
        elements: count("count(.//*)"),
        nodes: count("count(.//node())"),
        comments: count("count(.//comment())"),
        htmlBytes: new TextEncoder().encode(host.innerHTML).length,
      };
    });
    const mountedHeapBytes = await heap();
    const updates: {
      percent: number;
      changedFields: number;
      samples: Sample[];
      wallMs: Summary;
      taskCpuMs: Summary;
      layoutMs: Summary;
      frameSettleMs: Summary;
    }[] = [];
    let revision = 0;
    for (const percent of [1, 10, 100]) {
      const indices = selectFields(rows * 10, percent),
        samples: Sample[] = [];
      for (let sample = -3; sample < options.samples; sample++) {
        revision++;
        // Representative handles exist only until the post-update identity check.
        await page.evaluate(() => {
          const fields = document.querySelectorAll("[data-field]");
          window.__identity = [0, Math.floor(fields.length / 2), fields.length - 1].map((i) => {
            const element = fields[i]!;
            return { i, element, text: [...element.childNodes].find((n) => n.nodeType === 3) };
          });
        });
        const measurement = await timed("update", [indices, revision]);
        const layout = await settle(page);
        indices.forEach((index) => (expected[index] = revision));
        await validate(page, rows, expected);
        await page.evaluate(() => {
          try {
            const fields = document.querySelectorAll("[data-field]");
            for (const item of window.__identity!)
              if (fields[item.i] !== item.element || item.text?.parentNode !== item.element)
                throw Error("Text or element replaced");
          } finally {
            delete window.__identity;
          }
        });
        if (sample >= 0) samples.push({ ...measurement, ...layout });
      }
      updates.push({
        percent,
        changedFields: indices.length,
        samples,
        wallMs: summarize(samples.map((s) => s.wallMs)),
        taskCpuMs: summarize(samples.map((s) => s.taskCpuMs)),
        layoutMs: summarize(samples.map((s) => s.layoutMs)),
        frameSettleMs: summarize(samples.map((s) => s.frameSettleMs)),
      });
    }
    await page.evaluate(() => document.querySelector<HTMLElement>('[data-action="0"]')!.click());
    expected[0]!++;
    await validate(page, rows, expected);
    const disposal = await timed("dispose", []);
    await page.evaluate(() => {
      window.bench.dispose();
      if (document.querySelector("#host")!.childNodes.length) throw Error("DOM retained after disposal");
    });
    await settle(page);
    const disposedHeapBytes = await heap(),
      disposalCycles: number[] = [];
    for (let cycle = 0; cycle < 5; cycle++) {
      await page.evaluate((rows) => {
        window.bench.mount(rows);
        window.bench.dispose();
        if (document.querySelector("#host")!.childNodes.length) throw Error("DOM retained after cycle");
      }, rows);
      await settle(page);
      disposalCycles.push(await heap());
    }
    if (errors.length) throw Error(errors.join("\n"));
    return {
      framework,
      rows,
      repeat,
      load1,
      mount: { ...mount, ...mountSettle },
      size,
      updates,
      disposal,
      memory: {
        baselineHeapBytes,
        mountedHeapBytes,
        mountedDeltaBytes: mountedHeapBytes - baselineHeapBytes,
        disposedHeapBytes,
        disposedDeltaBytes: disposedHeapBytes - baselineHeapBytes,
        disposalCycles,
        cycleGrowthBytes: disposalCycles.at(-1)! - disposalCycles[0]!,
      },
      correctness: "passed",
    };
  } finally {
    await context.close();
  }
}

const result = () => ({
  started,
  finished: new Date().toISOString(),
  options,
  environment: {
    browser: browser.version(),
    crossOriginIsolated: true,
    platform: platform(),
    arch: arch(),
    cpu: cpus()[0]?.model,
    cpuCount: cpus().length,
    totalMemoryBytes: totalmem(),
    node: process.version,
  },
  manifest,
  experimentSources,
  methodology: {
    /**
     * Protocol id; scoreboard.ts compares it with competitors.json `dom.provenance.protocol` (mismatch = n/a).
     * nowrap-2026-11-06 = rewarm-2026-10-21 mount + wrapper-free page checks (`pageChecks`).
     */
    protocol: "nowrap-2026-11-06",
    updates:
      "Synchronous committed DOM; performance.now in-page. React flushSync, Solid preview flush, Solid stable synchronous signals, Rivet batch. No virtualization.",
    cpu: "Chromium TaskDuration with threadTicks: main-thread task CPU delta including evaluation/CDP bookkeeping; excludes GPU/workers and is not isolated framework CPU.",
    frames: "Forced layout then two requestAnimationFrame callbacks; frame settle is not a direct paint metric.",
    memory:
      "Chromium forced-GC JavaScript heap, not browser process RSS. Warmed page baseline; five disposal cycles; caches intentionally remain.",
    mount:
      "Warm-up mount + dispose, forced GC (baseline heap), one unforced mount + dispose cycle, two frames, one macrotask, then the timed mount (no forced GC right before it: V8's incremental-marking finalization delay would otherwise depend on task history).",
    pageChecks:
      "Size, page-size and field checks read XPath count() and #host textContent only (no node lists, walkers or childNodes), so the harness creates no JS wrapper for page nodes before or between timed phases; three fields + their text are wrapped for the per-update identity check. Before 2026-11-06 a TreeWalker size count after the mount wrapped every node (~335k at 5000 rows) before the updates, dispose and mounted heap.",
    sampling:
      "Fresh browser context per framework/row/repeat. Framework order rotates each repeat. Three warmup updates before sampled updates at each percentage. Validation outside measurement.",
  },
  trials,
});
try {
  for (const rows of options.rows)
    for (let repeat = 0; repeat < options.repeats; repeat++) {
      const frameworks = manifest.artifacts
        .map((artifact) => artifact.framework)
        .filter((framework) => !options.frameworks || options.frameworks.includes(framework));
      for (let offset = 0; offset < frameworks.length; offset++) {
        const framework = frameworks[(offset + repeat + options.offset) % frameworks.length]!;
        console.log(`Running ${framework} ${rows} rows repeat ${repeat + 1}/${options.repeats}`);
        trials.push(await trial(framework, rows, repeat));
        await writeFile(resolve(destination, "results.json"), JSON.stringify(result(), null, 2) + "\n");
      }
    }
  console.log(`Results: ${resolve(destination, "results.json")}`);
} catch (error) {
  await writeFile(
    resolve(destination, "failed.json"),
    JSON.stringify({ ...result(), error: String(error) }, null, 2) + "\n",
  );
  throw error;
} finally {
  await browser.close();
  await server.close();
}
