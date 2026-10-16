// DOM row regressions (found by the retired v1 ⇄ v2 parity harness): content read later by an insertion.
// - cdk live collections called DOM v2 accessors (`<For>` / `<Show>`) once, untracked, while placing
//   content inside their providers: `items` / Autocomplete filtering never updated (`place()`).
// - `_for` published a node snapshot before a re-rendered row's own effect ran (stale / duplicated rows).
// - `reconcile` anchored after the last current node even when it had left the parent: the new nodes
//   went to the parent's end instead of before the marker.
// Each scenario mounts compiled DOM output in happy-dom (dom-rows/harness.ts) and asserts the markup per step.
import { test } from "vitest";
import assert from "node:assert/strict";
import { environment, load, mountIn, settle, snapshot } from "./dom-rows/harness.ts";

const FIXTURE = new URL("./dom-rows/fixtures/rows.tsx", import.meta.url).pathname;
const strip = (html: string) => html.replace(/ (aria-[a-z-]+|data-[a-z-]+|class|role|tabindex|id)="[^"]*"/g, "");

async function run(name: string, writes: [string, unknown][]): Promise<string[]> {
  const env = await environment();
  const mod = await load(FIXTURE);
  (mod.items as { set(v: unknown): void }).set([{ id: "a", name: "A" }]);
  (mod.query as { set(v: unknown): void }).set("");
  await settle();
  const m = mountIn(env, mod[name] as never);
  assert.equal(m.error, null);
  await settle();
  const out = [strip(snapshot(m))];
  for (const [signal, value] of writes) {
    (mod[signal] as { set(v: unknown): void }).set(value);
    await settle();
    out.push(strip(snapshot(m)));
  }
  m.dispose?.();
  m.host.remove();
  return out;
}

const A = { id: "a", name: "A" },
  A2 = { id: "a", name: "A2" },
  B = { id: "b", name: "B" },
  C = { id: "c", name: "C" };

test("Autocomplete filter hides live ListBox options", async () => {
  const out = await run("Filtered", [
    ["query", "s"],
    ["query", "x"],
    ["query", ""],
  ]);
  assert.deepEqual(out, [
    "<div><div>Save</div><div>Split</div><div>Close</div></div>",
    "<div><div>Save</div><div>Split</div></div>",
    "<div></div>",
    "<div><div>Save</div><div>Split</div><div>Close</div></div>",
  ]);
});

for (const name of ["HostItems", "CollectionItems"])
  test(`live ListBox ${name} follow the items signal (add, same key new item, reorder, remove)`, async () => {
    const out = await run(name, [
      ["items", [A, B]],
      ["items", [A2, B]],
      ["items", [B, A2, C]],
      ["items", [C]],
    ]);
    assert.deepEqual(out, [
      "<div><div>A</div></div>",
      "<div><div>A</div><div>B</div></div>",
      "<div><div>A2</div><div>B</div></div>",
      "<div><div>B</div><div>A2</div><div>C</div></div>",
      "<div><div>C</div></div>",
    ]);
  });

test("For rows returning a function (Provider content) keep their place when re-rendered", async () => {
  const out = await run("RangeRows", [
    ["items", [A2, B]],
    ["items", [B, A]],
    ["items", [A2]],
  ]);
  assert.deepEqual(out, ["<ul><li>A</li></ul>", "<ul><li>A2</li><li>B</li></ul>", "<ul><li>B</li><li>A</li></ul>", "<ul><li>A2</li></ul>"]);
});
