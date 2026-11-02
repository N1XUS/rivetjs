// Node suite (FIX-UI 2026-11-01): the kanban keyboard / selection chunk loaders. A failed chunk fetch (flaky network) must
// not stay cached: the next event retries the import instead of reusing the rejected promise (which swallowed every
// later key and left the feature dead until reload).
import { test } from "vitest";
import assert from "node:assert/strict";
import { retryableLoad } from "../src/components/kanban/lazy.ts";

test("kanban lazy load: a rejected load is retried, a settled one is shared", async () => {
  let calls = 0;
  const load = retryableLoad(async () => {
    calls++;
    if (calls === 1) throw new Error("chunk fetch failed");
    return { ok: calls };
  });
  assert.equal(load.pending(), false);
  const first = load();
  assert.equal(load.pending(), true);
  await assert.rejects(first, /chunk fetch failed/);
  assert.equal(load.pending(), false, "a failed load is forgotten");
  const second = await load();
  assert.deepEqual(second, { ok: 2 });
  assert.equal(await load(), second, "a loaded module is reused");
  assert.equal(calls, 2);
});
