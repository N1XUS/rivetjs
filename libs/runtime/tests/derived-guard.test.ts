// `_guard` (`dom-derived-abi.ts`): a guarded signal's write runs the wake first. A wake that wraps `s.set` again (a woken
// record's lazy list waiting for this signal's first write, `dom-derived.ts` `wakeOnWrite`) must see this same write
// (TOGGLE-TABS-COLD: the first cold selection of an uncontrolled Tabs skipped the force-mounted panels' list).
import { test } from "vitest";
import assert from "node:assert/strict";
import { signal } from "@rivetjs/reactivity";
import { _guard } from "@rivetjs/runtime/dom-derived";

test("a wrapper the wake installs on the guarded signal sees the write that woke it", () => {
  const log: string[] = [];
  const s = signal(0);
  let woken = false;
  _guard(s, () => {
    log.push("wake");
    if (woken) return;
    woken = true;
    // `wakeOnWrite`'s shape: wrap, and on the write put the previous setter back and call it.
    const set = s.set;
    s.set = function (this: unknown, value: number) {
      s.set = set;
      log.push("list " + value);
      return set.call(this, value);
    } as typeof s.set;
  });
  s.set(1);
  assert.equal(s(), 1);
  assert.deepEqual(log, ["wake", "list 1", "wake"], "the list's wrapper ran before the setter");
  s.set(2);
  assert.equal(s(), 2);
  assert.deepEqual(log, ["wake", "list 1", "wake", "wake"]);
});
