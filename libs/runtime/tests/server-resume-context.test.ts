// An effect created during a resumable render re-runs in its own request's async context, even when
// a concurrent request's write triggers it (round-2 review C16).
import { test } from "vitest";
import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { effect, signal } from "@rivetjs/reactivity";
import { resumableToString } from "@rivetjs/runtime/server-resume";

test("a re-run triggered by another request's write runs in the creating request's context", async () => {
  const requests = new AsyncLocalStorage<string>();
  const shared = signal(0);
  const seen: [number, string | undefined][] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const a = requests.run("A", () =>
    resumableToString(
      () => () => {
        effect(() => void seen.push([shared(), requests.getStore()]));
        return gate.then(() => "a");
      },
      { manifest: { hash: "h", runtime: "/rt.js", symbols: {} } },
    ),
  );
  await requests.run("B", async () => {
    await Promise.resolve();
    shared.set(1);
  });
  release();
  assert.match(String(await a), /a/);
  assert.deepEqual(seen, [
    [0, "A"],
    [1, "A"],
  ]);
});
