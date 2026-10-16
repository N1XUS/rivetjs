import { test } from "vitest";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { _bindingEffect, signal, effect, createRoot, getOwner, runWithOwner, onCleanup,
  createContext, provide, useContext, untrack, type Owner } from "../index.ts";

// Inspect linkage without importing debug: debug intentionally retains every internal binding.
interface Linked { first: Linked | null; next: Linked | null; parent: Linked | null; disposed: boolean }
const linked = (owner: Owner | null): Linked => owner as unknown as Linked;
const children = (owner: Owner | null): Linked[] => {
  const list: Linked[] = [];
  for (let child = linked(owner).first; child; child = child.next) list.push(child);
  return list;
};
const recording = Boolean((globalThis as Record<symbol, unknown>)[Symbol.for("rivet.devtools")]);

test("private inert bindings release linkage while public effects retain their lifetime", () => {
  let owner: Owner | null = null, runs = 0;
  const source = signal(0);
  const root = createRoot(() => {
    owner = getOwner();
    _bindingEffect(() => { untrack(source); runs++; });
    assert.equal(children(owner).length, recording ? 1 : 0);
    effect(() => { runs++; });
    assert.equal(children(owner).length, recording ? 2 : 1);
  });
  source.set(1);
  assert.equal(runs, 2);
  root.dispose(); root.dispose();
  assert.deepEqual(children(owner), []);
});

test("private bindings retain sources, owned children, and cleanup callbacks", () => {
  const value = signal(0), seen: number[] = [], cleaned: string[] = [];
  let owner: Owner | null = null;
  const root = createRoot(() => {
    owner = getOwner();
    _bindingEffect(() => { const n = value(); seen.push(n); if (n < 2) value.set(n + 1); });
    _bindingEffect(() => effect(() => onCleanup(() => cleaned.push("child"))));
    _bindingEffect(() => onCleanup(() => cleaned.push("binding")));
  });
  assert.equal(children(owner).length, 3);
  assert.deepEqual(seen, [0, 1, 2]);
  value.set(3);
  assert.deepEqual(seen, [0, 1, 2, 3]);
  root.dispose();
  assert.deepEqual(cleaned, ["child", "binding"]);
  value.set(4);
  assert.deepEqual(seen, [0, 1, 2, 3]);
});

test("captured private binding owners support late children and keep provider identity", async () => {
  const token = createContext("missing"), value = signal(1), seen: string[] = [];
  let captured: Owner | null = null, cleaned = 0;
  const root = createRoot(() => provide(token, "provided", () => {
    _bindingEffect(() => { captured = getOwner(); assert.equal(useContext(token), "provided"); });
  }));
  await Promise.resolve();
  runWithOwner(captured, () => {
    assert.equal(getOwner(), captured);
    effect(() => seen.push(useContext(token) + value()));
    onCleanup(() => cleaned++);
  });
  value.set(2);
  assert.deepEqual(seen, ["provided1", "provided2"]);
  root.dispose();
  assert.equal(cleaned, 1);
  assert.throws(() => runWithOwner(captured, () => {}), /disposed owner/);
  value.set(3);
  assert.deepEqual(seen, ["provided1", "provided2"]);
});

test("a captured then disposed descendant keeps its private binding ancestor live", () => {
  let owner: Owner | null = null, descendant: Owner | null = null, cleaned = 0;
  const root = createRoot(() => {
    owner = getOwner();
    _bindingEffect(() => {
      const child = createRoot(() => { descendant = getOwner(); });
      child.dispose();
    });
  });
  const ancestor = linked(descendant).parent;
  assert.equal(children(owner).length, 1);
  assert.equal(children(owner)[0], ancestor);
  assert.equal(ancestor!.disposed, false);
  runWithOwner(ancestor as unknown as Owner, () => onCleanup(() => cleaned++));
  root.dispose();
  assert.equal(cleaned, 1);
});

test("nested private initialization and thrown inner reads restore escape probes", () => {
  let owner: Owner | null = null;
  const root = createRoot(() => {
    owner = getOwner();
    _bindingEffect(() => {
      _bindingEffect(() => {});
      assert.throws(() => _bindingEffect(() => { throw Error("inner failed"); }), /inner failed/);
    });
    _bindingEffect(() => {});
  });
  assert.equal(children(owner).length, recording ? 2 : 0);
  root.dispose();
});

test("an inner binding can expose an outer candidate through a disposed child", () => {
  let owner: Owner | null = null, escapedChild: Owner | null = null;
  const root = createRoot(() => {
    owner = getOwner();
    _bindingEffect(() => {
      _bindingEffect(() => {
        const child = createRoot(() => { escapedChild = getOwner(); });
        child.dispose();
      });
    });
  });
  const inner = linked(escapedChild).parent!, outer = inner.parent!;
  assert.equal(children(owner)[0], outer);
  assert.equal(outer.first, inner);
  assert.equal(inner.disposed, false);
  assert.equal(outer.disposed, false);
  root.dispose();
  assert.equal(inner.disposed, true);
  assert.equal(outer.disposed, true);
});

test("binding initialization preserves primary errors, flush failures, and parent disposal", () => {
  const value = signal(0);
  let owner: Owner | null = null;
  const root = createRoot(() => {
    owner = getOwner();
    effect(() => { if (value()) throw Error("peer failed"); });
    assert.throws(() => _bindingEffect(() => {
      value.set(1);
      throw Error("read failed");
    }), /read failed/);
    assert.equal(children(owner).length, 1, "failed binding disposed despite the peer flush error");
    _bindingEffect(() => {});
    assert.equal(children(owner).length, recording ? 2 : 1, "next probe is independent after failure");
  });
  root.dispose();
  const disposed = createRoot((stop) => {
    _bindingEffect(stop);
    return getOwner();
  });
  assert.equal(linked(disposed.value).disposed, true);
  disposed.dispose();
});


test("escaped computed getters retain binding ancestors before debug is imported", () => {
  // A fresh process matters: the development test preload already imports debug in this process.
  const source = `
    import assert from "node:assert/strict";
    const { _bindingEffect, computed, createRoot, getOwner, runWithOwner, onCleanup } =
      await import(${JSON.stringify(new URL("../index.ts", import.meta.url).href)});
    let saved, parent, cleaned = 0;
    const root = createRoot(() => {
      parent = getOwner();
      _bindingEffect(() => {
        const child = createRoot(() => computed(() => 1));
        saved = child.value;
        child.dispose();
      });
    });
    const { _debug } = await import(${JSON.stringify(new URL("../debug.ts", import.meta.url).href)});
    const binding = _debug(saved).parent().parent();
    assert.equal(binding.kind, "effect");
    assert.equal(binding.disposed, false);
    assert.equal(_debug(parent).children()[0].ref, binding.ref);
    runWithOwner(binding.ref, () => onCleanup(() => cleaned++));
    root.dispose();
    assert.equal(cleaned, 1);
    assert.equal(_debug(binding.ref).disposed, true);
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", source], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});
