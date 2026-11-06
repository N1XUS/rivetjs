// Filter first-input profile (lane FILTER): per lane dist, 4x CPU, first "g" keystroke into #filter.
// Reports event-timing processing time of keydown/input (no MutationObserver probe) and, with --profile,
// a CPU profile (50 µs) aggregated by self time.
// node apps/resume-bench/spikes/filter-profile.ts --dist apps/resume-bench/dist/rivet[,…] --reps 5 [--profile [--save <prefix>]] [--port 4521]
import { chromium } from "playwright";
import { resolve } from "node:path";
import { writeFileSync } from "node:fs";
import { serve } from "../serve.ts";
import { chromeTarget } from "../../../scripts/bench/shared.ts";

const arg = (name: string, fallback?: string) => {
  const i = process.argv.indexOf("--" + name);
  return i < 0 ? fallback : process.argv[i + 1];
};
const dists = arg("dist")!.split(",");
const reps = Number(arg("reps", "5"));
const profile = process.argv.includes("--profile");
const port = Number(arg("port", "4521"));
const text = arg("text", "g")!;

const browser = await chromium.launch({ ...chromeTarget(), headless: true });
const results: Record<string, Record<string, number[]>> = {};
const selfAll: Record<string, Map<string, number>> = {};
for (let r = 0; r < reps; r++)
  for (const [li, dist] of dists.entries()) {
    const server = await serve(resolve(dist), port + li);
    const context = await browser.newContext();
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.addInitScript(() => {
      const w = window as any;
      w.__ev = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as any[]) w.__ev.push([e.name, e.startTime, e.processingStart, e.processingEnd, e.duration]);
      }).observe({ type: "event", buffered: true, durationThreshold: 16 } as any);
      w.__paint = null;
    });
    // --rmtime (lane EACH): time spent inside removeChild / remove / replaceChild / insertBefore (wrapped; adds overhead to all lanes).
    if (process.argv.includes("--rmtime"))
      await page.addInitScript(() => {
        const w = window as any;
        w.__rm = { removeChild: [0, 0], remove: [0, 0], insertBefore: [0, 0], replaceChild: [0, 0] };
        for (const [proto, name] of [
          [Node.prototype, "removeChild"],
          [Element.prototype, "remove"],
          [CharacterData.prototype, "remove"],
          [Node.prototype, "insertBefore"],
          [Node.prototype, "replaceChild"],
        ] as const) {
          const fn = (proto as any)[name];
          (proto as any)[name] = function (this: unknown, ...args: unknown[]) {
            const t = performance.now();
            try {
              return fn.apply(this, args);
            } finally {
              const e = w.__rm[name];
              e[0] += performance.now() - t;
              e[1]++;
            }
          };
        }
      });
    // --mo: the runner's first-input sync probe (run.ts `probe` with `sync`), installed in every lane.
    if (process.argv.includes("--mo"))
      await page.addInitScript(() => {
        let seen: MutationRecord[] = [];
        const observer = new MutationObserver((records) => seen.push(...records));
        let live = false,
          done = false;
        const end = () => {
          if (!live) return;
          live = false;
          const records = seen.concat(observer.takeRecords());
          seen = [];
          observer.disconnect();
          const rows = document.getElementById("rows");
          (window as any).__sync = records.some((r) => rows && rows.contains(r.target));
        };
        addEventListener(
          "input",
          (e) => {
            if (done || !e.isTrusted) return;
            done = live = true;
            observer.observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
            setTimeout(end, 0);
          },
          true,
        );
        addEventListener("input", end);
      });
    await page.goto(server.url);
    await page.waitForTimeout(Number(arg("wait", "1500")));
    await page.click("#filter");
    await page.waitForTimeout(Number(arg("gap", "300")));
    // --pre <text>: typed (and settled) before the measured keys: later keys' cost alone.
    if (arg("pre")) (await page.keyboard.type(arg("pre")!), await page.waitForTimeout(500));
    if (profile) {
      await cdp.send("Profiler.enable");
      await cdp.send("Profiler.setSamplingInterval", { interval: Number(arg("interval", "50")) });
      await cdp.send("Profiler.start");
    }
    await page.evaluate(() => {
      const w = window as any;
      if (w.__rm) for (const e of Object.values(w.__rm) as number[][]) e[0] = e[1] = 0;
      const check = () => {
        if (document.querySelectorAll("#rows li").length !== 100 || (document.querySelector("#filter") as HTMLInputElement).value !== w.__want) return false;
        w.__rows = performance.now();
        requestAnimationFrame(() => {
          const c = new MessageChannel();
          c.port1.onmessage = () => (w.__paint = performance.now());
          c.port2.postMessage(0);
        });
        return true;
      };
      // Poll by rAF only (no MutationObserver on the list): paint timing without per-record cost.
      const tick = () => (check() ? 0 : requestAnimationFrame(tick));
      requestAnimationFrame(tick);
      addEventListener("keydown", (e) => (w.__kd ??= e.timeStamp), true);
    }, undefined);
    await page.evaluate((t) => ((window as any).__want = t), (arg("pre") ?? "") + text);
    await page.keyboard.type(text);
    await page.waitForFunction(() => (window as any).__paint != null, null, { timeout: 30000 });
    await page.waitForTimeout(300);
    const lane = dist.split("/").filter(Boolean).pop() + (li ? "#" + li : "");
    const out = (results[lane] ??= {});
    const { ev, kd, paint, rm } = await page.evaluate(() => ({
      ev: (window as any).__ev,
      kd: (window as any).__kd,
      paint: (window as any).__paint,
      rm: (window as any).__rm,
    }));
    if (rm)
      for (const [k, [t, n]] of Object.entries(rm as Record<string, [number, number]>))
        if (n) ((out["ms:" + k] ??= []).push(t), (out["n:" + k] ??= []).push(n));
    const input = (ev as any[]).filter((e) => e[0] === "input" && e[1] >= kd - 1)[0];
    const keydown = (ev as any[]).filter((e) => e[0] === "keydown" && e[1] >= kd - 1)[0];
    (out.inputProc ??= []).push(input ? input[3] - input[2] : NaN);
    (ev as any[])
      .filter((e) => e[0] === "input" && e[1] >= kd - 1)
      .forEach((e, i) => i && ((out["input" + i] ??= []).push(e[3] - e[2]), (out["inputStart" + i] ??= []).push(e[1] - kd)));
    (out.inputDur ??= []).push(input ? input[4] : NaN);
    (out.keydownProc ??= []).push(keydown ? keydown[3] - keydown[2] : NaN);
    // Input delay of the first keydown (an in-flight task when the key arrived) and keydown start → first input's end.
    (out.keydownDelay ??= []).push(keydown ? keydown[2] - keydown[1] : NaN);
    (out.toInputEnd ??= []).push(keydown && input ? input[3] - keydown[1] : NaN);
    (out.paint ??= []).push(paint - kd);
    if (profile) {
      const { profile: p } = await cdp.send("Profiler.stop");
      // --save <prefix>: the raw profile per lane + repeat (`<prefix>-<lane>-r<rep>.cpuprofile`, DevTools / tree tools).
      if (arg("save")) writeFileSync(`${arg("save")}-${dist.split("/").filter(Boolean).pop()}-r${r}.cpuprofile`, JSON.stringify(p));
      const self = (selfAll[lane] ??= new Map());
      const byId = new Map(p.nodes.map((n: any) => [n.id, n]));
      const dt = p.timeDeltas;
      const parent = new Map<number, number>();
      for (const n of p.nodes as any[]) for (const c of n.children ?? []) parent.set(c, n.id);
      const keyOf = (f: any) => (f.functionName || "(anon)") + " " + f.url.split("/").pop() + ":" + f.lineNumber + ":" + f.columnNumber;
      const incl = (selfAll[lane + " incl"] ??= new Map());
      for (let i = 0; i < p.samples.length; i++) {
        const seen = new Set<string>();
        for (let id: number | undefined = p.samples[i]; id !== undefined; id = parent.get(id)) {
          const k = keyOf((byId.get(id) as any).callFrame);
          if (!seen.has(k)) (seen.add(k), incl.set(k, (incl.get(k) ?? 0) + (dt[i] ?? 0) / 1000 / reps));
        }
      }
      for (let i = 0; i < p.samples.length; i++) {
        const n: any = byId.get(p.samples[i]);
        const f = n.callFrame;
        const key = (f.functionName || "(anon)") + " " + f.url.split("/").pop() + ":" + f.lineNumber + ":" + f.columnNumber;
        self.set(key, (self.get(key) ?? 0) + (dt[i] ?? 0) / 1000 / reps);
      }
    }
    await context.close();
    await server.close();
  }
await browser.close();
const med = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  return s[s.length >> 1];
};
for (const [lane, m] of Object.entries(results))
  console.log(
    lane,
    Object.entries(m)
      .map(([k, v]) => `${k} med ${med(v).toFixed(1)} [${v.map((x) => x.toFixed(1)).join(" ")}]`)
      .join(" | "),
  );
for (const [lane, self] of Object.entries(selfAll)) {
  console.log("\n== self ms/rep", lane);
  for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, Number(arg("top", "30")))) console.log(v.toFixed(2).padStart(8), k);
}
