// Performance detection logic with fake observer entries and fake DOM prototypes (deterministic): CLS
// session windows and per-component scores, long frames, interactions, frequent runs, chunk loads per
// interaction, forced-reflow bookkeeping and the reflow patch itself.
import { test } from "vitest";
import assert from "node:assert/strict";
import { CHUNK_WINDOW, FREQUENT, Perf, heatColor, rateCls, rateInp, type PerfEnv } from "../agent/perf.ts";
import { patchReflow } from "../agent/reflow.ts";

type FakeNode = { comp: number | null };
const node = (comp: number | null): FakeNode => ({ comp });
function setup(): { perf: Perf; located: Error[] } {
  const located: Error[] = [];
  const env: PerfEnv = {
    componentAt: (n) => (n as FakeNode).comp,
    ref: (id) => (id === 99 ? null : { id, name: "C" + id, file: "src/c" + id + ".tsx" }),
    locate: async (stack) => (located.push(stack), [{ file: "src/c1.tsx", line: 4, col: 2 }]),
    describe: () => ({ label: "effect #7" }),
  };
  return { perf: new Perf(env), located };
}
const rect = (width: number, height: number) => ({ x: 0, y: 0, width, height });

test("ratings and heat colors follow the thresholds", () => {
  assert.deepEqual([0.1, 0.11, 0.25, 0.26].map(rateCls), ["good", "needs-improvement", "needs-improvement", "poor"]);
  assert.deepEqual([200, 201, 500, 501].map(rateInp), ["good", "needs-improvement", "needs-improvement", "poor"]);
  assert.deepEqual([1, 2, 4, 8].map(heatColor), ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444"]);
});

test("layout shifts: session windows, input-driven shifts skipped, scores split by moved area", async () => {
  const { perf } = setup();
  const flashed: unknown[] = [];
  perf.onShift = (rects) => flashed.push(rects);
  perf.options.shifts = true;
  // Two shifts in one window (gap < 1 s): 0.08 + 0.04; area 3:1 between components 1 and 2.
  perf.shift({ value: 0.08, hadRecentInput: false, startTime: 100, sources: [{ node: node(1), previousRect: rect(30, 10), currentRect: rect(30, 10) }, { node: node(2), currentRect: rect(10, 20) }] });
  perf.shift({ value: 0.04, hadRecentInput: false, startTime: 600, sources: [{ node: node(1), currentRect: rect(10, 10) }] });
  perf.shift({ value: 0.5, hadRecentInput: true, startTime: 700, sources: [{ node: node(1) }] });
  // A new window (gap > 1 s), smaller.
  perf.shift({ value: 0.05, hadRecentInput: false, startTime: 3000, sources: [{ node: node(null) }] });
  const info = await perf.info();
  assert.equal(info.cls.value.toFixed(3), "0.120");
  assert.equal(info.cls.rating, "needs-improvement");
  assert.equal(info.cls.shifts, 3);
  const c1 = info.rows.find((r) => r.comp.id === 1)!, c2 = info.rows.find((r) => r.comp.id === 2)!;
  assert.equal(c1.cls.toFixed(3), "0.100");
  assert.equal(c2.cls.toFixed(3), "0.020");
  assert.ok(c1.reasons.includes("layout shift 0.100"));
  const shifts = info.findings.filter((f) => f.kind === "layout-shift");
  assert.deepEqual(shifts.map((f) => f.comps.map((c) => c.name)), [["C1", "C2"], ["C1"], []]);
  assert.match(shifts[0]!.detail, /<C1> 0\.060, <C2> 0\.020/);
  assert.match(shifts[2]!.detail, /no component/);
  assert.equal(shifts[0]!.hint.docs, "https://web.dev/articles/cls");
  assert.equal(flashed.length, 2, "flashes only shifts with rects (option on)");
});

test("long frames: component runs inside the frame, scripts listed; short frames ignored", async () => {
  const { perf } = setup();
  perf.run({}, 1, 30, 105);
  perf.run({}, 1, 10, 120);
  perf.run({}, 2, 5, 130);
  perf.run({}, 3, 50, 400);
  perf.frame({ entryType: "long-animation-frame", startTime: 100, duration: 80, blockingDuration: 30, scripts: [{ invoker: "BUTTON#go.onclick", sourceURL: "http://x/src/c1.tsx?t=1", sourceFunctionName: "onGo", duration: 60 }] });
  perf.frame({ entryType: "long-animation-frame", startTime: 380, duration: 40 });
  const info = await perf.info();
  const frames = info.findings.filter((f) => f.kind === "long-frame");
  assert.equal(frames.length, 1);
  assert.equal(frames[0]!.title, "Long frame 80 ms (30 ms blocking)");
  assert.deepEqual(frames[0]!.comps.map((c) => c.name), ["C1", "C2"]);
  assert.match(frames[0]!.detail, /<C1> 40\.0 ms \/ 2 runs, <C2> 5\.0 ms/);
  assert.match(frames[0]!.detail, /BUTTON#go\.onclick → onGo \(c1\.tsx\) 60 ms/);
  assert.equal(info.rows.find((r) => r.comp.id === 1)!.longMs, 40);
  assert.equal(info.rows.find((r) => r.comp.id === 3)!.longMs, 0);
});

test("interactions: input delay / processing / presentation, runs while handling, slow ones flagged", async () => {
  const { perf } = setup();
  perf.input("click", node(5), 1000);
  perf.run({}, 5, 40, 1030);
  perf.run({}, 6, 100, 1100);
  perf.run({}, 7, 1, 2000);
  // pointerdown (short), then the click of the same interaction (longest is kept).
  perf.event({ name: "pointerdown", interactionId: 9, startTime: 1000, processingStart: 1002, processingEnd: 1004, duration: 24, target: node(5) });
  perf.event({ name: "click", interactionId: 9, startTime: 1010, processingStart: 1020, processingEnd: 1150, duration: 260, target: node(5) });
  perf.event({ name: "mousemove", startTime: 1500, processingStart: 1500, processingEnd: 1501, duration: 20 });
  const info = await perf.info();
  assert.equal(info.interactions.length, 1);
  const click = info.interactions[0]!;
  assert.deepEqual([click.type, click.inputDelay, click.processing, click.presentation, click.duration], ["click", 10, 130, 120, 260]);
  assert.equal(click.target?.name, "C5");
  assert.deepEqual(click.handlers.map((h) => [h.comp.name, h.ms]).sort(), [["C5", 40], ["C6", 100]]);
  assert.deepEqual(info.inp, { value: 260, rating: "needs-improvement", type: "click" });
  const slow = info.findings.find((f) => f.kind === "slow-interaction")!;
  assert.equal(slow.title, "Slow click 260 ms");
  assert.match(slow.detail, /Mostly processing/);
  assert.deepEqual(slow.comps.map((c) => c.name), ["C6", "C5"]);
});

test("frequent runs: one effect re-running N times for one interaction names its component", async () => {
  const { perf } = setup();
  const effect = {};
  perf.input("keydown", node(3), 0);
  for (let i = 0; i < FREQUENT + 2; i++) perf.run(effect, 3, 1, 10 + i);
  // Outside the input's window: not counted.
  perf.run(effect, 3, 1, 5000);
  const info = await perf.info();
  const runs = info.findings.filter((f) => f.kind === "frequent-runs");
  assert.equal(runs.length, 1, "one finding per node and interaction");
  assert.equal(runs[0]!.title, "effect #7 ran 12× for one keydown");
  assert.deepEqual(runs[0]!.comps.map((c) => c.name), ["C3"]);
  const row = info.rows.find((r) => r.comp.id === 3)!;
  assert.equal(row.maxRuns, FREQUENT + 2);
  assert.equal(row.hot, true);
  assert.ok(row.reasons.some((r) => /ran 12× for one interaction/.test(r)));
});

test("chunks: script loads after an input belong to it (sizes, timing); devtools and late loads ignored", async () => {
  const { perf } = setup();
  perf.resumed = true;
  perf.input("click", node(4), 1000);
  perf.resource({ name: "http://x/assets/cart-abc.js", initiatorType: "script", startTime: 1010, responseEnd: 1060, transferSize: 2048 });
  perf.resource({ name: "http://x/assets/cart.css", initiatorType: "link", startTime: 1010, responseEnd: 1020, transferSize: 100 });
  perf.resource({ name: "http://x/__rivet/devtools/assets/ui.js", initiatorType: "script", startTime: 1010, responseEnd: 1020 });
  perf.resource({ name: "http://x/assets/late.js", initiatorType: "script", startTime: 1000 + CHUNK_WINDOW + 1, responseEnd: 4500 });
  perf.event({ name: "click", interactionId: 3, startTime: 1000, processingStart: 1001, processingEnd: 1070, duration: 80, target: node(4) });
  const info = await perf.info();
  assert.deepEqual(info.interactions[0]!.chunks.map((c) => [c.url, c.bytes, c.ms]), [["http://x/assets/cart-abc.js", 2048, 50]]);
  assert.deepEqual(info.resume, { resumed: true, first: { type: "click", duration: 80, chunks: 1, bytes: 2048 }, chunks: 1, bytes: 2048 });
  const chunks = info.findings.find((f) => f.kind === "chunks")!;
  assert.equal(chunks.title, "1 chunk (2.0 KB) loaded after a click");
  assert.deepEqual(chunks.comps.map((c) => c.name), ["C4"]);
});

test("forced reflows: repeats at one site count up; source frames resolved once; unmounted components dropped from rows", async () => {
  const { perf, located } = setup();
  const site = () => Object.assign(new Error("read"), { stack: "Error: read\n    at measure (http://x/src/c1.tsx:4:2)" });
  perf.reflow("offsetWidth", 1, site(), 10, "run");
  perf.reflow("offsetWidth", 1, site(), 20, "run");
  perf.reflow("getBoundingClientRect", 99, site(), 30, "handler");
  const info = await perf.info();
  const reflows = info.findings.filter((f) => f.kind === "forced-reflow");
  assert.deepEqual(reflows.map((f) => [f.title, f.count, f.comps[0]?.name]), [["Forced reflow: offsetWidth", 2, "C1"], ["Forced reflow: getBoundingClientRect", 1, "unmounted"]]);
  assert.match(reflows[0]!.detail, /inside an effect or binding of <C1>/);
  assert.match(reflows[1]!.detail, /inside an event handler/);
  assert.deepEqual(reflows[0]!.location, { file: "src/c1.tsx", line: 4, col: 2 });
  assert.deepEqual(info.rows.map((r) => [r.comp.name, r.reflows]), [["C1", 2]]);
  await perf.info();
  assert.equal(located.length, 2, "each stack located once");
  perf.reset();
  assert.deepEqual((await perf.info()).findings, []);
});

test("reflow patch: a layout read after a write in the same task is reported once; quiet and uninstall", () => {
  class FakeElement {
    width = 10;
    get offsetWidth(): number {
      return this.width;
    }
    getBoundingClientRect(): { width: number } {
      return { width: this.width };
    }
    setAttribute(_name: string, _value: string): void {}
  }
  class FakeStyle {
    #w = "";
    get width(): string {
      return this.#w;
    }
    set width(value: string) {
      this.#w = value;
    }
  }
  const reads: string[] = [];
  const tasks: (() => void)[] = [];
  const original = Object.getOwnPropertyDescriptor(FakeElement.prototype, "offsetWidth")!;
  const patch = patchReflow(
    [
      { target: FakeElement.prototype, reads: ["offsetWidth"], readMethods: ["getBoundingClientRect"], writeMethods: ["setAttribute"] },
      { target: FakeStyle.prototype, writes: ["width"] },
    ],
    (name, receiver) => reads.push(name + (receiver instanceof FakeElement ? "@el" : "")),
    (fn) => tasks.push(fn),
  );
  const el = new FakeElement(), style = new FakeStyle();
  assert.equal(el.offsetWidth, 10, "reads without a write: nothing");
  style.width = "5px";
  assert.equal(style.width, "5px", "setters still write");
  assert.equal(el.offsetWidth, 10);
  el.getBoundingClientRect();
  assert.deepEqual(reads, ["offsetWidth@el"], "the second read finds layout clean");
  el.setAttribute("a", "b");
  // The task ends: layout is clean again.
  tasks.splice(0).forEach((fn) => fn());
  el.getBoundingClientRect();
  assert.deepEqual(reads, ["offsetWidth@el"]);
  patch.quiet(() => {
    el.setAttribute("a", "c");
    el.getBoundingClientRect();
  });
  assert.equal(patch.dirty, false, "quiet writes do not mark");
  el.setAttribute("a", "d");
  patch.quiet(() => el.getBoundingClientRect());
  el.getBoundingClientRect();
  assert.deepEqual(reads, ["offsetWidth@el", "getBoundingClientRect@el"]);
  patch.uninstall();
  assert.deepEqual(Object.getOwnPropertyDescriptor(FakeElement.prototype, "offsetWidth"), original);
  el.setAttribute("a", "e");
  void el.offsetWidth;
  assert.equal(reads.length, 2);
});

test("a resumed page's switch to client render: its own shifts and frames are dropped, the switch is marked", async () => {
  const { perf } = setup();
  perf.resumed = true;
  perf.shift({ value: 0.02, hadRecentInput: false, startTime: 100, sources: [{ node: node(1), currentRect: rect(10, 10) }] });
  perf.clientRender(2000, 2100);
  // During the switch (and 500 ms after): the re-render's shifts and its long frame are not the page's.
  perf.shift({ value: 0.3, hadRecentInput: false, startTime: 2050, sources: [{ node: node(1), currentRect: rect(10, 10) }] });
  perf.shift({ value: 0.3, hadRecentInput: false, startTime: 2550, sources: [{ node: node(1), currentRect: rect(10, 10) }] });
  perf.frame({ entryType: "long-animation-frame", startTime: 1990, duration: 120 });
  perf.shift({ value: 0.01, hadRecentInput: false, startTime: 9000, sources: [{ node: node(1), currentRect: rect(10, 10) }] });
  const info = await perf.info();
  assert.equal(info.cls.shifts, 2);
  assert.equal(info.cls.value.toFixed(3), "0.020");
  assert.equal(info.findings.filter((f) => f.kind === "long-frame").length, 0);
  assert.equal(info.resume.switchedAt, 2000);
  assert.equal(info.resume.resumed, true);
});
