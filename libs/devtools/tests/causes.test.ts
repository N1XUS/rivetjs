// "Why did this update" and Performance timing over the reactivity façade: causes are the writes the
// run actually depends on (not every write of the same task), and runs nested in another run (a
// computed pulled by an effect) count once in self time.
import { test } from "vitest";
import assert from "node:assert/strict";
import { HOOK, _debug } from "@rivetjs/reactivity/debug";
import { createHook } from "../agent/hook.ts";
import { Model } from "../agent/model.ts";
import { Perf } from "../agent/perf.ts";
import { displayName } from "../protocol.ts";

const hook = createHook(2);
(globalThis as { [HOOK]?: unknown })[HOOK] = hook;
const r = await import("../../reactivity/dev.ts");
const model = new Model(
  () => _debug,
  () => hook,
);
model.connected = true;
hook.on = (event) => model.handle(event);
const named = <T>(value: T, name: string): T => (hook.emit("name", { value, name }), value);
const busy = (ms: number) => {
  const end = performance.now() + ms;
  while (performance.now() < end);
};

test("causes: only writes the run depends on (directly or through computeds), not every write of the task", async () => {
  let first!: object, second!: object;
  const a = named(r.signal(0), "a"),
    b = named(r.signal(0), "b");
  r.createRoot(() => {
    first = r.getOwner()!;
    r.effect(() => void a());
    hook.emit("comp.mount", { owner: first, fn: function First() {}, props: {} });
  });
  r.createRoot(() => {
    second = r.getOwner()!;
    const doubled = r.computed(() => b() * 2);
    r.effect(() => void doubled());
    hook.emit("comp.mount", { owner: second, fn: function Second() {}, props: {} });
  });
  await Promise.resolve();
  // Same task: a's write is pending when b's effect runs.
  a.set(1);
  b.set(1);
  const names = async (owner: object) => (await model.owner(model.id(owner)))!.lastUpdate?.causes.map((c) => displayName(c.signal, { scoped: false }));
  assert.deepEqual(await names(first), ["a"]);
  assert.deepEqual(await names(second), ["b"], "a's write did not re-run Second");
});

test("self time: a computed's run inside an effect's run is not counted twice", async () => {
  const perf = new Perf({
    componentAt: () => null,
    ref: (id) => model.perfRef(id),
    locate: async () => [],
    describe: (node) => model.describeNode(node),
  });
  perf.recording = true;
  model.perf = perf;
  let owner!: object;
  const source = r.signal(0);
  r.createRoot(() => {
    owner = r.getOwner()!;
    hook.emit("comp.mount", { owner, fn: function Heavy() {}, props: {} });
    const slow = r.computed(() => (busy(20), source()));
    r.effect(() => void slow());
  });
  const row = (await perf.info()).rows.find((row) => row.comp.id === model.id(owner))!;
  assert.equal(row.runs, 2);
  assert.ok(row.ms >= 40, "total: inclusive times summed (" + row.ms + ")");
  // Self time subtracts the computed's run (≥ 20 ms) from the effect's once (timing-noise free).
  assert.ok(row.ms - row.self >= 19.99 && row.self <= row.ms, "self: the nested 20 ms counted once (" + row.self + " of " + row.ms + ")");
  model.perf = null;
});
