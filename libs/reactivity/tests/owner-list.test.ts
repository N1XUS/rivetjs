import { test } from "vitest";
import assert from "node:assert/strict";
import { createRoot, effect, getOwner, onCleanup, signal, _detach } from "@rivetjs/reactivity";

// Owner child lists are circular through `prev` (the newest child's `prev` is the oldest), so disposal reaches the
// oldest child without a walk. These pin creation-order disposal across every unlink position.

interface Model {
  name: string;
  children: Model[];
  dispose: () => void;
  disposed: boolean;
}

function tree(log: string[], name: string, depth: number, width: number): Model {
  let model!: Model;
  const root = createRoot(() => {
    const children: Model[] = [];
    if (depth > 0) for (let i = 0; i < width; i++) children.push(tree(log, `${name}.${i}`, depth - 1, width));
    onCleanup(() => log.push(name));
    model = { name, children, dispose: () => {}, disposed: false };
  });
  model.dispose = () => {
    model.disposed = true;
    root.dispose();
  };
  return model;
}
// Expected cleanup order of a model: children in creation order (post-order), then the node itself.
function expected(model: Model, out: string[] = []): string[] {
  if (model.disposed) return out;
  for (const child of model.children) expected(child, out);
  out.push(model.name);
  return out;
}
function markDisposed(model: Model): void {
  model.disposed = true;
  model.children.forEach(markDisposed);
}

test("dispose runs cleanups in creation order after removing the oldest, a middle and the newest child", () => {
  for (const remove of [[0], [2], [4], [0, 4], [1, 3], [4, 3, 2, 1], [0, 1, 2, 3], [2, 0, 4], [0, 1, 2, 3, 4]]) {
    const log: string[] = [];
    const root = tree(log, "r", 2, 5);
    for (const index of remove) {
      const child = root.children[index]!,
        want = expected(child),
        before = log.length;
      child.dispose();
      markDisposed(child);
      assert.deepEqual(log.slice(before), want);
    }
    const before = log.length;
    const want = expected(root);
    root.dispose();
    assert.deepEqual(log.slice(before), want, `removed ${remove.join(",")}`);
  }
});

test("children added after removals keep creation order (random adds and removals)", () => {
  let seed = 7;
  const random = (n: number) => ((seed = (seed * 1103515245 + 12345) % 2147483648), seed % n);
  for (let round = 0; round < 200; round++) {
    const log: string[] = [],
      live: string[] = [],
      disposers = new Map<string, () => void>();
    let id = 0;
    const root = createRoot(() => {
      for (let step = 0; step < 30; step++) {
        if (live.length && random(3) === 0) {
          const name = live.splice(random(live.length), 1)[0]!;
          disposers.get(name)!();
          assert.equal(log.at(-1), name);
        } else {
          const name = `c${id++}`;
          live.push(name);
          disposers.set(name, createRoot(() => onCleanup(() => log.push(name))).dispose);
        }
      }
    });
    const before = log.length;
    root.dispose();
    assert.deepEqual(log.slice(before), live, `round ${round}`);
  }
});

test("a cleanup that disposes newer siblings mid-dispose: each runs once, the rest stay in creation order", () => {
  const log: string[] = [];
  let b!: () => void, d!: () => void;
  const root = createRoot(() => {
    createRoot(() => onCleanup(() => (log.push("a"), b(), d())));
    b = createRoot(() => onCleanup(() => log.push("b"))).dispose;
    createRoot(() => onCleanup(() => log.push("c")));
    d = createRoot(() => onCleanup(() => log.push("d"))).dispose;
    onCleanup(() => log.push("root"));
  });
  root.dispose();
  assert.deepEqual(log, ["a", "b", "d", "c", "root"]);
});

test("a cleanup that disposes the newest sibling of a re-running effect: reset keeps creation order", () => {
  const log: string[] = [],
    run = signal(0);
  let newest: (() => void) | null = null;
  const stop = effect(() => {
    const n = run();
    createRoot(() => onCleanup(() => (log.push(`${n}:a`), newest?.())));
    createRoot(() => onCleanup(() => log.push(`${n}:b`)));
    newest = createRoot(() => onCleanup(() => log.push(`${n}:c`))).dispose;
  });
  run.set(1);
  assert.deepEqual(log, ["0:a", "0:c", "0:b"]);
  stop();
  assert.deepEqual(log, ["0:a", "0:c", "0:b", "1:a", "1:c", "1:b"]);
});

test("detaching the oldest, a middle or the newest child leaves a list that still disposes in creation order", () => {
  for (const which of [0, 1, 2]) {
    const log: string[] = [],
      handles: ReturnType<typeof getOwner>[] = [];
    const root = createRoot(() => {
      for (const name of ["x", "y", "z"]) createRoot(() => (onCleanup(() => log.push(name)), handles.push(getOwner())));
    });
    _detach(handles[which]!);
    root.dispose();
    assert.deepEqual(
      log,
      ["x", "y", "z"].filter((_, i) => i !== which),
      `detached ${which}`,
    );
  }
});
