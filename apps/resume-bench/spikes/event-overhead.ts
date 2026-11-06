// Per-event overhead after boot (lane KEYDOWN): per built lane dist, 4x CPU, after the page booted and adopted
// (`#filter` click + a typed "g"), dispatches N synthetic events per kind on fixed targets and reports µs per event
// (median of the rounds). Synthetic events pass the same capture / delegated listeners as trusted ones (no default
// action: no `input` follows a keydown, no click activation), so this isolates loader + runtime + delegation cost.
// node apps/resume-bench/spikes/event-overhead.ts --dist <a>[,<b>…] [--reps 6] [--n 200] [--rounds 5] [--port 4550]
import { chromium } from "playwright";
import { resolve } from "node:path";
import { serve } from "../serve.ts";
import { chromeTarget } from "../../../scripts/bench/shared.ts";

const arg = (name: string, fallback?: string) => {
  const i = process.argv.indexOf("--" + name);
  return i < 0 ? fallback : process.argv[i + 1];
};
const dists = arg("dist")!.split(",");
const reps = Number(arg("reps", "6"));
const n = Number(arg("n", "200"));
const rounds = Number(arg("rounds", "5"));
const port = Number(arg("port", "4550"));
const far = process.argv.includes("--no-type") ? 900 : 90;
// kind → [event constructor, type, target selector, init]
const kinds: [string, string, string, string, Record<string, unknown>][] = [
  ["keydown@filter", "KeyboardEvent", "keydown", "#filter", { key: "x", code: "KeyX" }],
  ["keyup@filter", "KeyboardEvent", "keyup", "#filter", { key: "x", code: "KeyX" }],
  ["input@filter", "InputEvent", "input", "#filter", {}],
  ["pointerdown@filter", "PointerEvent", "pointerdown", "#filter", { pointerType: "mouse", button: 0, isPrimary: true }],
  ["pointerdown@row", "PointerEvent", "pointerdown", "#rows li:nth-child(7) a", { pointerType: "mouse", button: 0, isPrimary: true }],
  ["mousedown@row", "MouseEvent", "mousedown", "#rows li:nth-child(7) a", { button: 0 }],
  ["focusin@filter", "FocusEvent", "focusin", "#filter", {}],
  ["keydown@body", "KeyboardEvent", "keydown", "body", { key: "x", code: "KeyX" }],
  ["pointerover@row", "PointerEvent", "pointerover", "#rows li:nth-child(7) a", { pointerType: "mouse" }],
  ["pointerdown@rowFar", "PointerEvent", "pointerdown", "#rows li:nth-child(" + far + ") a", { pointerType: "mouse", button: 0, isPrimary: true }],
  ["click@rowFarpick", "MouseEvent", "click", "#rows li:nth-child(" + far + ") button", { button: 0 }],
];

const browser = await chromium.launch({ ...chromeTarget(), headless: true });
const results: Record<string, Record<string, number[]>> = {};
const profiles: Record<string, Map<string, number>> = {};
for (let r = 0; r < reps; r++)
  for (const [li, dist] of dists.entries()) {
    const server = await serve(resolve(dist), port + li);
    const context = await browser.newContext();
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.goto(server.url);
    await page.waitForTimeout(1500);
    if (!process.argv.includes("--click-far")) await page.click("#filter");
    await page.waitForTimeout(300);
    // --click-far: trusted mouse clicks on the `pick` buttons of rows 900, 901, 902 (first one adopts): pointerdown
    // timeStamp → the row's class change (MutationObserver), ms, per click.
    if (process.argv.includes("--click-far")) {
      const out = (results[dist.split("/").filter(Boolean).pop() + (li ? "#" + li : "")] ??= {});
      for (const k of [900, 901, 902]) {
        await page.evaluate((k) => {
          const w = window as any;
          w.__t = w.__m = null;
          addEventListener("pointerdown", (e) => (w.__t ??= e.timeStamp), { capture: true, once: true });
          const li = document.querySelector(`#rows li:nth-child(${k})`)!;
          new MutationObserver((_, o) => li.className.includes("sel") && ((w.__m = performance.now()), o.disconnect())).observe(li, { attributes: true });
        }, k);
        const pc = process.argv.includes("--profile-click") && k === 900;
        if (pc) {
          await cdp.send("Profiler.enable");
          await cdp.send("Profiler.setSamplingInterval", { interval: 50 });
          await cdp.send("Profiler.start");
        }
        await page.click(`#rows li:nth-child(${k}) .pick`);
        await page.waitForFunction(() => (window as any).__m != null);
        if (pc) {
          const { profile: p } = await cdp.send("Profiler.stop");
          const byId = new Map(p.nodes.map((n: any) => [n.id, n]));
          const parent = new Map<number, number>();
          for (const n of p.nodes as any[]) for (const c of n.children ?? []) parent.set(c, n.id);
          const key = (f: any) => (f.functionName || "(anon)") + " " + (f.url.split("/").pop() || "inline") + ":" + f.lineNumber + ":" + f.columnNumber;
          const self = (profiles["self"] ??= new Map()),
            incl = (profiles["incl"] ??= new Map());
          for (let i = 0; i < p.samples.length; i++) {
            const dt = (p.timeDeltas[i + 1] ?? 0) / 1000 / reps;
            const k0 = key((byId.get(p.samples[i]) as any).callFrame);
            self.set(k0, (self.get(k0) ?? 0) + dt);
            const seen = new Set<string>();
            for (let id: number | undefined = p.samples[i]; id !== undefined; id = parent.get(id)) {
              const kk = key((byId.get(id) as any).callFrame);
              if (!seen.has(kk)) (seen.add(kk), incl.set(kk, (incl.get(kk) ?? 0) + dt));
            }
          }
        }
        (out["clickFar" + (k - 900)] ??= []).push(await page.evaluate(() => (window as any).__m - (window as any).__t));
        await page.waitForTimeout(300);
      }
      await context.close();
      await server.close();
      continue;
    }
    // --no-type: the full 1,000-row server list (rows adopt lazily); else "g" first (100 rows).
    if (!process.argv.includes("--no-type")) await page.keyboard.type("g");
    await page.waitForTimeout(800);
    // --profile <kind>: a 20 µs CPU profile of 2,000 dispatches of that kind, self time per frame (first rep, first dist).
    const prof = arg("profile");
    if (prof && r === 0 && li === 0) {
      await cdp.send("Profiler.enable");
      await cdp.send("Profiler.setSamplingInterval", { interval: 20 });
      await cdp.send("Profiler.start");
      const [, ctor, type, sel, init] = kinds.find((k) => k[0] === prof)!;
      await page.evaluate(
        ([ctor, type, sel, init]) => {
          const el = document.querySelector(sel as string)!;
          const C = (window as any)[ctor as string];
          for (let i = 0; i < 2000; i++) el.dispatchEvent(new C(type, { bubbles: true, composed: true, cancelable: true, ...(init as object) }));
        },
        [ctor, type, sel, init] as const,
      );
      const { profile: p } = await cdp.send("Profiler.stop");
      const byId = new Map(p.nodes.map((n: any) => [n.id, n]));
      const self = new Map<string, number>();
      for (let i = 0; i < p.samples.length; i++) {
        const f = (byId.get(p.samples[i]) as any).callFrame;
        const k = (f.functionName || "(anon)") + " " + (f.url.split("/").pop() || "inline") + ":" + f.lineNumber + ":" + f.columnNumber;
        self.set(k, (self.get(k) ?? 0) + (p.timeDeltas[i] ?? 0) / 2000);
      }
      console.log("== self µs/event", prof);
      for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(v.toFixed(2).padStart(8), k);
    }
    const out = (results[dist.split("/").filter(Boolean).pop() + (li ? "#" + li : "")] ??= {});
    const times = await page.evaluate(
      ([kinds, n, rounds]) => {
        const res: Record<string, number> = {};
        for (const [name, ctor, type, sel, init] of kinds as [string, string, string, string, Record<string, unknown>][]) {
          const el = document.querySelector(sel)!;
          const C = (window as any)[ctor];
          const per: number[] = [];
          // Warm the path once (first-use compilation is not per-event overhead).
          el.dispatchEvent(new C(type, { bubbles: true, composed: true, cancelable: true, ...init }));
          for (let k = 0; k < rounds; k++) {
            const t = performance.now();
            for (let i = 0; i < (n as number); i++) el.dispatchEvent(new C(type, { bubbles: true, composed: true, cancelable: true, ...init }));
            per.push(((performance.now() - t) * 1000) / (n as number));
          }
          per.sort((a, b) => a - b);
          res[name] = per[per.length >> 1]!;
        }
        return res;
      },
      [kinds.map(([name, ctor, type, sel, init]) => [name, ctor, type, sel, init]), n, rounds] as const,
    );
    for (const [k, v] of Object.entries(times)) (out[k] ??= []).push(v);
    await context.close();
    await server.close();
  }
await browser.close();
const med = (a: number[]) => [...a].sort((x, y) => x - y)[a.length >> 1]!;
const names = kinds.map((k) => k[0]);
console.log("µs/event (median of reps)".padEnd(22), names.map((k) => k.padStart(18)).join(""));
for (const [lane, m] of Object.entries(results)) console.log(lane.padEnd(22), names.map((k) => (m[k] ? med(m[k]!).toFixed(1) : "-").padStart(18)).join(""));
for (const [lane, m] of Object.entries(results))
  for (const [k, v] of Object.entries(m))
    if (!names.includes(k)) console.log(lane, k, "ms med", med(v).toFixed(2), "[" + v.map((x) => x.toFixed(1)).join(" ") + "]");
for (const [k, m] of Object.entries(profiles)) {
  console.log("== first far click,", k, "ms/rep");
  for (const [f, v] of [...m].sort((a, b) => b[1] - a[1]).slice(0, 35)) console.log(v.toFixed(2).padStart(8), f);
}
