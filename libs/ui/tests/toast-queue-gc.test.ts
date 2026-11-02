// Node suite (FIX-UI 2026-11-01, review R2 / R3 leaks): the module registry of exit-aware toast queues must not keep an
// unreachable queue alive (a `new ToastQueue()` per component instance / SSR request / test retained every queue and its
// toasts forever). `gc` comes from V8 flags at runtime (no `--expose-gc` needed on the command line).
import { test } from "vitest";
import assert from "node:assert/strict";
import { setFlagsFromString } from "node:v8";
import { runInNewContext } from "node:vm";

setFlagsFromString("--expose-gc");
const gc = runInNewContext("gc") as () => void;

const { ToastQueue } = await import("../src/components/toast/toast-queue.ts");

test("toast queue: an unreachable queue is collectable (weak registry)", async () => {
  let collected = false;
  const registry = new FinalizationRegistry(() => (collected = true));
  (() => {
    const queue = new ToastQueue();
    queue.add({ title: "hello" } as never);
    // The registry holds the inner exit-aware queue (the one a toast region looks up).
    registry.register((queue as unknown as { queue: object }).queue, "queue");
  })();
  for (let i = 0; i < 20 && !collected; i++) {
    gc();
    await new Promise((r) => setTimeout(r, 10));
  }
  assert.equal(collected, true, "the registry released the queue");
});
