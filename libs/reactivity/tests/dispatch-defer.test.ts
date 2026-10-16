import { test } from "vitest";
import assert from "node:assert/strict";
// Package specifier: `--conditions=development` runs these through the development façade.
import { signal, computed, effect, batch, createRoot, catchError, getOwner, _dispatch, _settle, _deferredFlush } from "@rivetjs/reactivity";

// `_dispatch` of the first trusted mouse click per document (`view`) whose handlers queue effects defers their
// flush to a task posted at once (Chrome stalls the frame after the first DOM-changing mouse click of a tab by
// ~25–45 ms; later clicks paint a frame sooner synchronously). Node cannot create trusted events: the
// dispatcher only reads `isTrusted` / `type` / `pointerType` / `view`, so plain objects stand in — each with a
// fresh `view` (a new document) unless one is passed.
const click = (pointerType = "mouse", isTrusted = true, type = "click", view: object = {}) => ({ isTrusted, type, pointerType, view }) as unknown as Event;
const task = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function setup() {
  const count = signal(0),
    log: number[] = [];
  const root = createRoot((dispose) => {
    effect(() => {
      log.push(count());
    });
    return dispose;
  });
  return { count, log, dispose: root.value };
}

test("trusted mouse click: handler runs now, its flush one task later", async () => {
  const { count, log } = setup();
  const doubled = computed(() => count() * 2);
  let seen: unknown[] = [];
  _dispatch(
    null,
    () => {
      count.set(1);
      seen = [count(), doubled()];
    },
    null,
    click(),
  );
  assert.deepEqual(seen, [1, 2], "reads after the write see new values (computed pulls)");
  assert.deepEqual(log, [0], "effect deferred");
  assert.equal(count(), 1);
  await task();
  assert.deepEqual(log, [0, 1]);
});

for (const [name, event] of [
  ['keyboard click (pointerType "")', click("")],
  ["touch tap", click("touch")],
  ["pen", click("pen")],
  ["untrusted (synthetic / testing-library) click", click("mouse", false)],
  ["trusted mouse pointerup", click("mouse", true, "pointerup")],
  ["trusted mousedown", click("mouse", true, "mousedown")],
] as const)
  test(`${name}: flushes synchronously`, () => {
    const { count, log } = setup();
    _dispatch(null, () => count.set(1), null, event);
    assert.deepEqual(log, [0, 1]);
  });

test("nothing queued: no deferred flush, later writes flush synchronously; the document stays unsettled", async () => {
  const { count, log } = setup();
  const view = {};
  _dispatch(null, () => {}, null, click("mouse", true, "click", view));
  count.set(2);
  assert.deepEqual(log, [0, 2]);
  // The first click that queues effects is still deferred.
  _dispatch(null, () => count.set(3), null, click("mouse", true, "click", view));
  assert.deepEqual(log, [0, 2]);
  await task();
  assert.deepEqual(log, [0, 2, 3]);
});

test("later mouse clicks on the same document flush synchronously", async () => {
  const { count, log } = setup();
  const view = {};
  _dispatch(null, () => count.set(1), null, click("mouse", true, "click", view));
  assert.deepEqual(log, [0]);
  await task();
  _dispatch(null, () => count.set(2), null, click("mouse", true, "click", view));
  assert.deepEqual(log, [0, 1, 2]);
  // Another document (iframe / new page) defers its own first one.
  _dispatch(null, () => count.set(3), null, click());
  assert.deepEqual(log, [0, 1, 2]);
  await task();
  assert.deepEqual(log, [0, 1, 2, 3]);
  // No view (not a UIEvent): never deferred.
  _dispatch(null, () => count.set(4), null, { isTrusted: true, type: "click", pointerType: "mouse" } as unknown as Event);
  assert.deepEqual(log, [0, 1, 2, 3, 4]);
});

test("handlers of the same event share one deferred flush (bubbling path)", async () => {
  const { count, log } = setup();
  const event = click();
  _dispatch(null, () => count.set(1), null, event);
  _dispatch(null, () => count.set(count() + 1), null, event);
  assert.deepEqual(log, [0]);
  await task();
  assert.deepEqual(log, [0, 2]);
});

test("another event flushes the pending click before its handler runs", async () => {
  const { count, log } = setup();
  const order: string[] = [];
  const view = signal("");
  createRoot(() =>
    effect(() => {
      if (view()) order.push("effect " + view());
    }),
  );
  _dispatch(
    null,
    () => {
      count.set(1);
      view.set("a");
    },
    null,
    click(),
  );
  _dispatch(
    null,
    () => {
      order.push("handler 2 sees " + log.join());
      view.set("b");
    },
    null,
    click(),
  );
  assert.deepEqual(order, ["effect a", "handler 2 sees 0,1"], "first click applied before the second handler");
  assert.deepEqual(log, [0, 1]);
  await task();
  assert.deepEqual(order, ["effect a", "handler 2 sees 0,1", "effect b"]);
  // A keyboard event after a pending click: same rule, then its own synchronous flush.
  _dispatch(null, () => view.set("c"), null, click());
  _dispatch(null, () => view.set("d"), null, click(""));
  assert.deepEqual(order.slice(3), ["effect c", "effect d"]);
});

test("a batch or a signal write outside a batch runs the pending flush first", () => {
  const { count, log } = setup();
  const other = signal(0),
    seen: string[] = [];
  createRoot(() =>
    effect(() => {
      seen.push("other " + other());
    }),
  );
  _dispatch(null, () => count.set(1), null, click());
  other.set(1);
  assert.deepEqual(log, [0, 1]);
  assert.deepEqual(seen, ["other 0", "other 1"]);
  _dispatch(null, () => count.set(2), null, click());
  batch(() => {
    assert.deepEqual(log, [0, 1, 2], "flushed before the batch body");
    count.set(3);
  });
  assert.deepEqual(log, [0, 1, 2, 3]);
  _dispatch(null, () => count.set(4), null, click());
  // An effect created outside a batch (a mount) also starts from the applied state.
  createRoot(() =>
    effect(() => {
      seen.push("mount sees " + log.at(-1));
    }),
  );
  assert.equal(seen.at(-1), "mount sees 4");
});

test("_settle runs the pending flush now (test helpers)", () => {
  const { count, log } = setup();
  _dispatch(null, () => count.set(1), null, click());
  assert.deepEqual(log, [0]);
  _settle();
  assert.deepEqual(log, [0, 1]);
  _settle();
  assert.deepEqual(log, [0, 1]);
});

test("handler errors are synchronous; the deferred flush still runs", async () => {
  const { count, log } = setup();
  assert.throws(
    () =>
      _dispatch(
        null,
        () => {
          count.set(1);
          throw new Error("handler");
        },
        null,
        click(),
      ),
    /handler/,
  );
  assert.deepEqual(log, [0]);
  await task();
  assert.deepEqual(log, [0, 1]);
});

test("deferred effect errors: owner handlers, else onError, else reportError", async () => {
  const fail = signal(false),
    caught: unknown[] = [];
  createRoot(() =>
    catchError(
      () =>
        effect(() => {
          if (fail()) throw new Error("owned");
        }),
      (error) => {
        caught.push((error as Error).message);
      },
    ),
  );
  _dispatch(null, () => fail.set(true), null, click());
  assert.deepEqual(caught, []);
  await task();
  assert.deepEqual(caught, ["owned"]);

  const boom = signal(0),
    reported: unknown[] = [];
  createRoot(() =>
    effect(() => {
      if (boom()) throw new Error("boom " + boom());
    }),
  );
  _dispatch(
    null,
    () => boom.set(1),
    null,
    click(),
    (error) => reported.push("onError " + (error as Error).message),
  );
  await task();
  assert.deepEqual(reported, ["onError boom 1"]);

  const original = globalThis.reportError;
  globalThis.reportError = (error: unknown) => reported.push("reportError " + (error as Error).message);
  try {
    _dispatch(null, () => boom.set(2), null, click());
    // Released by an unrelated write: the failure is reported, never thrown into that caller.
    signal(0).set(1);
    const other = signal(0);
    createRoot(() =>
      effect(() => {
        other();
      }),
    );
    other.set(1);
    assert.deepEqual(reported, ["onError boom 1", "reportError boom 2"]);
  } finally {
    globalThis.reportError = original;
    boom.set(0);
  }
});

test("disposal before the task: disposed effects never run", async () => {
  const { count, log, dispose } = setup();
  _dispatch(null, () => count.set(1), null, click());
  dispose();
  await task();
  assert.deepEqual(log, [0]);
});

test("a disposed owner drops the event; a live owner is current in the handler", async () => {
  const { count, log } = setup();
  const scope = createRoot((dispose) => ({ dispose, owner: getOwner() }));
  let current: unknown = "unset";
  _dispatch(
    scope.value.owner,
    () => {
      current = getOwner();
      count.set(1);
    },
    null,
    click(),
  );
  assert.equal(current, scope.value.owner);
  scope.value.dispose();
  _dispatch(
    scope.value.owner,
    () => {
      current = "ran";
    },
    null,
    click(),
  );
  assert.equal(current, scope.value.owner, "dropped");
  await task();
  assert.deepEqual(log, [0, 1], "the write made before disposal still flushes");
});

test("a click dispatched inside a batch (or a flush) joins it: no deferral", () => {
  const { count, log } = setup();
  batch(() => {
    _dispatch(null, () => count.set(1), null, click());
    assert.deepEqual(log, [0]);
  });
  assert.deepEqual(log, [0, 1]);
  const trigger = signal(0);
  createRoot(() =>
    effect(() => {
      if (trigger()) _dispatch(null, () => count.set(2), null, click());
    }),
  );
  trigger.set(1);
  assert.deepEqual(log, [0, 1, 2]);
});

test("_deferredFlush(): true only while a deferred click's flush runs", async () => {
  // DOM v2 removals keep the hovered element one frame in that flush (navigation under the pointer).
  const { count } = setup();
  const seen: boolean[] = [];
  createRoot(() => effect(() => (count(), seen.push(_deferredFlush()))));
  _dispatch(null, () => (count.set(1), seen.push(_deferredFlush())), null, click());
  assert.deepEqual(seen, [false, false], "the handler runs before the flush");
  await task();
  assert.deepEqual(seen, [false, false, true], "the deferred flush");
  assert.equal(_deferredFlush(), false);
  count.set(2);
  assert.deepEqual(seen, [false, false, true, false], "a later synchronous write");
});
