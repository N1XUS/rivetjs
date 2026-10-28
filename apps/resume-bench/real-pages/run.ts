import { chromium, type Browser } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { loadavg, cpus } from "node:os";
import { createHash } from "node:crypto";
import { serve } from "../serve.ts";
import { readBuildManifest, type BuildManifest } from "../provenance.ts";
import { chromeTarget } from "../../../scripts/bench/shared.ts";
import { withBenchLock } from "../../dom-bench/bench-lock.ts";
import { pages, mainInteraction, markup, verifyPage, type RealPage } from "./contract.ts";
import { realLanes, type RealLane } from "./fixture.ts";
import { buildPage, output } from "./build.ts";
import { writeReport, type RealResult, type Sample } from "./report.ts";

interface Probe {
  fcp: number;
  lcp: number;
  tasks: [number, number][];
  click: number;
  mutation: number;
  paint: number;
}
declare global {
  interface Window {
    __real: Probe;
  }
}
function probe() {
  const m = (window.__real = { fcp: 0, lcp: 0, tasks: [] as [number, number][], click: 0, mutation: 0, paint: 0 });
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) m.tasks.push([e.startTime, e.duration]);
  }).observe({ type: "longtask", buffered: true });
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) if (e.name === "first-contentful-paint") m.fcp = e.startTime;
  }).observe({ type: "paint", buffered: true });
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) m.lcp = e.startTime;
  }).observe({ type: "largest-contentful-paint", buffered: true });
  addEventListener(
    "click",
    (e) => {
      if (e.isTrusted && !m.click) m.click = e.timeStamp;
    },
    true,
  );
}
async function sample(browser: Browser, url: string, lane: RealLane, kind: RealPage, condition: string, repeat: number): Promise<Sample> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const cdp = await context.newCDPSession(page);
  try {
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp.send("Performance.enable");
    if (condition === "slow") {
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 150,
        downloadThroughput: (1.6 * 1024 * 1024) / 8,
        uploadThroughput: (750 * 1024) / 8,
      });
    }
    const types = new Map<string, string>();
    const loaded: { type: string; bytes: number }[] = [];
    cdp.on("Network.responseReceived", (e) => {
      types.set(e.requestId, /javascript/.test(e.response.mimeType) || /\.m?js(\?|$)/.test(e.response.url) ? "Script" : e.type);
      if (e.response.status >= 400 && !e.response.url.endsWith("favicon.ico")) errors.push(`HTTP ${e.response.status}: ${e.response.url}`);
    });
    cdp.on("Network.loadingFinished", (e) => loaded.push({ type: types.get(e.requestId) ?? "Other", bytes: e.encodedDataLength }));
    await page.addInitScript(probe);
    await page.goto(url, { waitUntil: "load" });
    await page.waitForTimeout(1000);
    const metrics = await cdp.send("Performance.getMetrics");
    const before = await page.evaluate(() => ({
      ...window.__real,
      cutoff: performance.now(),
      inlineScriptBytes: [...document.scripts]
        .filter((s) => !s.src && (!s.type || s.type === "module" || s.type === "text/javascript"))
        .reduce((n, s) => n + new TextEncoder().encode(s.textContent ?? "").length, 0),
    }));
    const js = loaded.filter((r) => r.type === "Script");
    const main = mainInteraction[kind];
    // Same rAF -> MessageChannel paint proxy as resume-bench/run.ts; observer armed before input.
    await page.evaluate(({ result, text }) => {
      const observer = new MutationObserver(() => {
        if (document.querySelector(result)?.textContent !== text) return;
        observer.disconnect();
        window.__real.mutation = performance.now();
        requestAnimationFrame(() => {
          const channel = new MessageChannel();
          channel.port1.onmessage = () => {
            window.__real.paint = performance.now();
            channel.port1.close();
            channel.port2.close();
          };
          channel.port2.postMessage(0);
        });
      });
      observer.observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
    }, main);
    await page.locator(main.target).first().click();
    await page.waitForFunction(() => window.__real.paint > 0);
    const after = await page.evaluate(() => window.__real);
    if (errors.length) throw Error(errors.join("; "));
    return {
      lane,
      page: kind,
      condition,
      repeat,
      load1: loadavg()[0]!,
      htmlBytes: Buffer.byteLength(await readFile(resolve(output(lane, kind), "index.html"))),
      htmlTransferBytes: loaded.find((r) => r.type === "Document")?.bytes ?? 0,
      jsBytes: js.reduce((sum, r) => sum + r.bytes, 0),
      jsRequests: js.length,
      inlineScriptBytes: before.inlineScriptBytes,
      cpuBeforeInput: 1000 * (metrics.metrics.find((m) => m.name === "TaskDuration")?.value ?? 0),
      fcp: before.fcp,
      lcp: before.lcp,
      tbt: before.tasks.reduce((sum, [start, duration]) => sum + (start >= before.fcp ? Math.max(0, Math.min(duration, before.cutoff - start) - 50) : 0), 0),
      inputToPaint: after.paint - after.click,
      inputToMutation: after.mutation - after.click,
    };
  } finally {
    await context.close();
  }
}

export async function runRealPages(args: string[]) {
  const option = (name: string, fallback: string) => {
    const i = args.indexOf("--" + name);
    return i < 0 ? fallback : args[i + 1]!;
  };
  const lanes = option("lanes", realLanes.join(",")).split(",") as RealLane[];
  const selectedPages = option("pages", pages.join(",")).split(",") as RealPage[];
  const conditions = option("conditions", "fast,slow").split(",");
  const repeats = Number(option("repeats", "5"));
  const port = Number(option("port", "4520"));
  if (
    lanes.some((l) => !realLanes.includes(l)) ||
    new Set(lanes).size !== lanes.length ||
    selectedPages.some((p) => !pages.includes(p)) ||
    conditions.some((c) => !["fast", "slow"].includes(c)) ||
    !Number.isInteger(repeats) ||
    repeats < 5 ||
    !Number.isInteger(port) ||
    port < 4520 ||
    port > 4529
  )
    throw Error("Invalid real suite options (>=5 repeats, existing production lanes, ports 4520–4529)");
  const artifact = resolve(option("out", ".artifacts/real-pages/" + new Date().toISOString().replace(/[:.]/g, "-")));
  await mkdir(artifact, { recursive: true });
  const result: RealResult = {
    protocol: "real-pages-v1",
    started: new Date().toISOString(),
    commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    command: ["node apps/resume-bench/run.ts", ...args].join(" "),
    uptimeStart: execFileSync("uptime", { encoding: "utf8" }).trim(),
    uptimeEnd: "",
    cpu: cpus()[0]?.model ?? "unknown",
    chrome: "",
    node: process.version,
    lanes,
    pages: selectedPages,
    conditions,
    repeats,
    builds: {},
    verification: {},
    errors: [],
    runs: [],
  };
  const save = async () => {
    result.uptimeEnd = execFileSync("uptime", { encoding: "utf8" }).trim();
    await writeFile(resolve(artifact, "results.json"), JSON.stringify(result, null, 2) + "\n");
  };
  for (const lane of lanes)
    for (const kind of selectedPages) {
      try {
        if (args.includes("--build")) {
          console.log("build real", lane, kind);
          await buildPage(lane, kind);
        }
        result.builds[`${lane}/${kind}`] = await readBuildManifest(lane, output(lane, kind));
      } catch (e) {
        result.errors.push({ lane, page: kind, phase: "build", message: String(e) });
      }
    }
  const browser = await chromium.launch({ ...chromeTarget(), headless: true, args: ["--use-mock-keychain", "--password-store=basic"] });
  result.chrome = browser.version();
  const parity = new Map<string, string>();
  try {
    for (const lane of lanes)
      for (const kind of selectedPages) {
        const key = `${lane}/${kind}`;
        if (!result.builds[key]) continue;
        const server = await serve(output(lane, kind), port);
        const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, permissions: ["clipboard-read", "clipboard-write"] });
        const page = await context.newPage();
        page.setDefaultTimeout(10000);
        const pageErrors: string[] = [];
        page.on("pageerror", (e) => pageErrors.push(e.message));
        try {
          // Check the delivered SSR DOM independently of any client replacement.
          const ssr = await browser.newContext({ javaScriptEnabled: false });
          let signature: string;
          try {
            const p = await ssr.newPage();
            await p.goto(server.url);
            signature = await markup(p);
          } finally {
            await ssr.close();
          }
          const ref = parity.get(kind);
          if (ref && ref !== signature) {
            await writeFile(resolve(artifact, `${lane}-${kind}-markup.txt`), signature);
            throw Error("SSR markup parity mismatch");
          }
          parity.set(kind, signature);
          await page.goto(server.url);
          if ((await markup(page)) !== signature) throw Error("Hydration changed initial markup");
          await verifyPage(page, kind);
          if (pageErrors.length) throw Error(pageErrors.join("; "));
          result.verification[key] = {
            passed: true,
            markupHash: createHash("sha256").update(signature).digest("hex"),
            elements: await page.locator("#real-page *").count(),
          };
          console.log("verify", key, "PASS");
        } catch (e) {
          result.verification[key] = { passed: false };
          result.errors.push({ lane, page: kind, phase: "verify", message: String(e) });
          console.error("verify", key, String(e));
        } finally {
          await context.close();
          await server.close();
        }
      }
    await save();
    if (!args.includes("--verify"))
      await withBenchLock("real pages", async () => {
        for (const condition of conditions)
          for (const kind of selectedPages)
            for (let repeat = 0; repeat < repeats; repeat++) {
              // A cyclic Latin-square order: each lane occupies each position once in five rounds.
              const order = lanes.map((_, i) => lanes[(i + repeat) % lanes.length]!);
              for (const lane of order) {
                if (!result.verification[`${lane}/${kind}`]?.passed) continue;
                const server = await serve(output(lane, kind), port);
                try {
                  result.runs.push(await sample(browser, server.url, lane, kind, condition, repeat));
                  process.stdout.write(".");
                } catch (e) {
                  result.errors.push({ lane, page: kind, phase: `${condition}/${repeat}`, message: String(e) });
                  console.error(String(e));
                } finally {
                  await server.close();
                  await save();
                }
              }
            }
      });
  } finally {
    await browser.close();
    await save();
  }
  if (!args.includes("--verify")) await writeReport(result, resolve(option("report", resolve(artifact, "report.md"))));
  console.log("\nReal-page results:", resolve(artifact, "results.json"));
  if (result.errors.length) process.exitCode = 1;
}
