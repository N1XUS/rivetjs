import { test } from "vitest";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { onCleanup } from "@rivetjs/reactivity";
import { Async } from "@rivetjs/runtime/server";
import { renderResumable } from "@rivetjs/runtime/server-resume";

test("aborting a resumable stream releases a pending Async without waiting for its load", async () => {
  const request = new AbortController();
  let resolveLoad!: (value: string) => void;
  const load = new Promise<string>((resolve) => (resolveLoad = resolve));
  const chunks: string[] = [];
  let cleanup = 0,
    children = 0,
    settled = false;
  const result = Promise.resolve(
    renderResumable(
      () =>
        Async({
          load: () => {
            onCleanup(() => cleanup++);
            return load;
          },
          fallback: () => "pending",
          children: (value) => {
            children++;
            return value;
          },
        }),
      { write: (chunk) => void chunks.push(chunk) },
      { stream: {}, signal: request.signal },
    ),
  );
  void result.then(
    () => (settled = true),
    () => (settled = true),
  );
  try {
    // Drain the shell's promise continuations into the segment wait; the load remains gated.
    await setImmediate();
    assert.ok(chunks.join("").includes("pending"));
    assert.deepEqual({ settled, cleanup }, { settled: false, cleanup: 0 });
    const writes = chunks.length;
    request.abort(new Error("request disconnected"));
    // One event-loop turn drains abort continuations, without a timeout or resolving the load.
    await setImmediate();
    assert.deepEqual(
      { settled, cleanup },
      { settled: true, cleanup: 1 },
      "aborted resume stream must settle and dispose its pending Async before the load resolves",
    );
    resolveLoad("late");
    await result;
    await setImmediate();
    assert.deepEqual({ cleanup, children, writes: chunks.length }, { cleanup: 1, children: 0, writes });
  } finally {
    resolveLoad("late");
    await result;
  }
});
