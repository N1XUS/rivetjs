// Context frames (owners point at the nearest provider frame; lookups walk providers, long lookups memoize
// on the starting frame), catchError through frames, and owner-first flush ordering through deep chains
// (> LONG = 32 ancestors: the verified-owner walk).
import { test } from "vitest";
import assert from "node:assert/strict";
import { signal, effect, batch, createRoot, createContext, provide, useContext, catchError, getOwner, runWithOwner, onCleanup } from "@rivetjs/reactivity";
import { _debug } from "@rivetjs/reactivity/debug";

/** Nest `depth` effect owners (each run creates the next), then call `leaf` inside the innermost one. */
function nest(depth: number, leaf: () => void): void {
  const level = (n: number): void => {
    if (n === 0) return leaf();
    effect(() => level(n - 1));
  };
  level(depth);
}

test("nearest provider wins through deep owner chains; default without one", () => {
  const A = createContext("a0"),
    B = createContext("b0");
  const seen: string[] = [];
  createRoot(() => {
    seen.push(useContext(A));
    provide(A, "a1", () =>
      nest(200, () =>
        provide(B, "b1", () =>
          nest(50, () => {
            seen.push(useContext(A), useContext(B));
            provide(A, "a2", () => nest(3, () => seen.push(useContext(A), useContext(B))));
          }),
        ),
      ),
    );
  });
  assert.deepEqual(seen, ["a0", "a1", "b1", "a2", "b1"]);
});

test("wide provider stacks: memoized lookups stay exact (hits, defaults, shadowing, later siblings)", () => {
  const tokens = Array.from({ length: 40 }, (_, i) => createContext(-i));
  const Missing = createContext("none");
  const reads: number[][] = [];
  createRoot(() => {
    const stack = (i: number, fn: () => void): void => (i === tokens.length ? fn() : provide(tokens[i]!, i, () => stack(i + 1, fn)));
    stack(0, () => {
      // Twice from the same frame: the second read of each token hits the memo.
      for (let round = 0; round < 2; round++) {
        reads.push(tokens.map((t) => useContext(t)));
        assert.equal(useContext(Missing), "none");
      }
      // A nested provider shadows token 0 for its subtree only, also after the outer frame memoized it.
      provide(tokens[0]!, 100, () => {
        reads.push([useContext(tokens[0]!), useContext(tokens[1]!)]);
        reads.push([useContext(tokens[0]!), useContext(tokens[1]!)]);
      });
      reads.push([useContext(tokens[0]!)]);
      // A sibling owner created after the memo shares the frame (and its memo).
      createRoot(() => reads.push([useContext(tokens[0]!), useContext(tokens[39]!)]));
    });
  });
  const all = tokens.map((_, i) => i);
  assert.deepEqual(reads, [all, all, [100, 1], [100, 1], [0], [0, 39]]);
});

test("captured owners keep their frames: runWithOwner, effects re-running later, disposed providers", () => {
  const C = createContext("default");
  const value = signal(0);
  const seen: string[] = [];
  let captured: ReturnType<typeof getOwner> = null;
  const root = createRoot((dispose) => {
    provide(C, "provided", () =>
      nest(40, () => {
        captured = getOwner();
        effect(() => {
          value();
          seen.push(useContext(C));
        });
      }),
    );
    return dispose;
  });
  value.set(1);
  assert.equal(
    runWithOwner(captured, () => useContext(C)),
    "provided",
  );
  root.value();
  assert.deepEqual(seen, ["provided", "provided"]);
  assert.equal(useContext(C), "default");
});

test("catchError finds the nearest handler through frames; a throwing handler forwards upward", () => {
  const C = createContext("outer");
  const log: string[] = [];
  const boom = signal(false);
  createRoot(() => {
    catchError(
      () =>
        provide(C, "inner", () =>
          nest(100, () =>
            catchError(
              () =>
                nest(60, () =>
                  effect(() => {
                    if (boom()) throw new Error("boom");
                  }),
                ),
              (error) => {
                // The handler runs under its catchError owner: context and getOwner() work.
                log.push(`inner:${(error as Error).message}:${useContext(C)}:${getOwner() !== null}`);
                throw new Error("forwarded");
              },
            ),
          ),
        ),
      (error) => log.push(`outer:${(error as Error).message}:${useContext(C)}`),
    );
  });
  boom.set(true);
  assert.deepEqual(log, ["inner:boom:inner:true", "outer:forwarded:outer"]);
});

test("owner-first flush through deep chains: a dirty ancestor effect runs first, its stale child never runs", () => {
  for (const depth of [5, 40, 300]) {
    const show = signal(true),
      value = signal(0);
    const ran: string[] = [];
    createRoot(() => {
      // The owner reads only `show`; the deep child reads `value`. Written child-first in one batch, the
      // child is queued before its owner: the flush must run the (dirty) owner first, which disposes it.
      effect(() => {
        if (!show()) return void ran.push("owner:hidden");
        ran.push("owner:shown");
        nest(depth, () =>
          effect(() => {
            ran.push(`child:${value()}`);
          }),
        );
      });
    });
    ran.length = 0;
    batch(() => {
      value.set(1);
      show.set(false);
    });
    assert.deepEqual(ran, ["owner:hidden"], `depth ${depth}`);
  }
});

test("owner-first flush: siblings sharing a deep clean chain, newly dirty owners mid-flush", () => {
  const tick = signal(0),
    gate = signal(0);
  const ran: string[] = [];
  createRoot(() =>
    nest(80, () => {
      // Many leaves under one deep clean chain: the verified walk is shared between them.
      for (let i = 0; i < 5; i++)
        effect(() => {
          ran.push(`leaf${i}:${tick()}`);
        });
      // An owner effect that a leaf's write dirties during the flush; its child must then wait for it.
      effect(() => {
        ran.push(`gate:${gate()}`);
        nest(40, () =>
          effect(() => {
            ran.push(`inner:${tick()}:${gate()}`);
          }),
        );
      });
      effect(() => {
        if (tick() === 1) gate.set(1);
      });
    }),
  );
  ran.length = 0;
  tick.set(1);
  // `inner` runs before the writer dirties `gate`; once `gate` is dirty (queued mid-flush), it re-runs first.
  assert.deepEqual(ran, ["leaf0:1", "leaf1:1", "leaf2:1", "leaf3:1", "leaf4:1", "inner:1:0", "gate:1", "inner:1:1"]);
});

test("owner-first flush: an owner verified clean earlier in the flush turns dirty, later children wait for it", () => {
  const tick = signal(0),
    gate = signal(0);
  const ran: string[] = [];
  createRoot(() =>
    nest(60, () => {
      // Queued first and owning a child: the flush walks owners (owner-first) from the start.
      effect(() => {
        tick();
        effect(() => {});
      });
      effect(() => {
        const g = gate();
        ran.push(`gate:${g}`);
        // x1 walks through `gate` (still clean: verified), then the writer dirties `gate`, then x2 runs.
        nest(40, () => effect(() => void ran.push(`x1:${tick()}:${g}`)));
        effect(() => {
          if (tick() === 1) gate.set(1);
        });
        nest(40, () => effect(() => void ran.push(`x2:${tick()}:${g}`)));
      });
    }),
  );
  ran.length = 0;
  tick.set(1);
  assert.deepEqual(ran, ["x1:1:0", "gate:1", "x1:1:1", "x2:1:1"]);
});

test("debug views report a token only on the providing owner (frames are inherited by descendants)", () => {
  const C = createContext(0);
  let provider: ReturnType<typeof getOwner> = null,
    below: ReturnType<typeof getOwner> = null;
  createRoot(() =>
    provide(C, 7, () => {
      provider = getOwner();
      createRoot(() => {
        below = getOwner();
        onCleanup(() => {});
      });
    }),
  );
  const view = _debug(provider)!;
  assert.equal(view.token, C);
  assert.equal(view.context, 7);
  assert.equal(_debug(below)!.token, undefined);
  assert.equal(_debug(below)!.parent()!.token, C);
});
