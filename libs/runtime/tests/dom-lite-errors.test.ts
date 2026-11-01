import assert from "node:assert/strict";
import { test } from "vitest";
import { Window } from "happy-dom";
import { delegate, effect, signal } from "../dom-lite-core.ts";

// The lite twin of reactivity's flush: one throwing binding does not leave the other queued bindings stale.
test("lite signal write: a throwing binding is rethrown after the other bindings ran", () => {
  const count = signal(0);
  const seen: number[] = [];
  const failure = Error("binding failed");
  effect(() => {
    if (count() === 1) throw failure;
  });
  effect(() => void seen.push(count()));
  assert.throws(
    () => count.set(1),
    (error) => error === failure,
  );
  assert.deepEqual(seen, [0, 1]);
  // The graph stays live: the next write runs both bindings again.
  count.set(2);
  assert.deepEqual(seen, [0, 1, 2]);
});

test("lite delegation: a throwing handler is reported, ancestors run, currentTarget is restored, bindings flush", async () => {
  const window = new Window();
  const document = window.document as unknown as Document;
  const errors: unknown[] = [];
  window.addEventListener("error", (event) => {
    errors.push((event as unknown as { error: unknown }).error);
    event.preventDefault();
  });
  try {
    const parent = document.createElement("div"),
      button = document.createElement("button");
    parent.append(button);
    document.body.append(parent);
    const count = signal(0);
    const seen: number[] = [];
    effect(() => void seen.push(count()));
    const log: string[] = [];
    const failure = Error("handler failed");
    (button as unknown as Record<string, unknown>).$rclick = () => {
      log.push("button");
      count.set(1);
      throw failure;
    };
    (parent as unknown as Record<string, unknown>).$rclick = (event: Event) => log.push("parent:" + (event.currentTarget === parent));
    document.addEventListener("click", (event) => delegate(event));
    let seenTarget: unknown = "unset";
    document.addEventListener("click", (event) => (seenTarget = event.currentTarget));
    button.click();
    assert.deepEqual(log, ["button", "parent:true"]);
    assert.deepEqual(seen, [0, 1]);
    assert.equal(seenTarget, document);
    assert.deepEqual(errors, [failure]);
  } finally {
    await window.happyDOM.close();
  }
});
