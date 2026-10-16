// Function Bridge T2 + T3: module references (`_rMod(() => value, id[, 1])`) encode as capture-free `{f}` entries anywhere.
import { test, vi } from "vitest";
import assert from "node:assert/strict";
import { signal } from "@rivetjs/reactivity";
import { _rEffect, _rFn, _rMod, resumableToString } from "@rivetjs/runtime/server-resume";
import { DEV } from "#dev";
import { FX, roundTrip } from "./resume/bridge-encode.ts";
import { stamp as stampX } from "./resume/bridge-stamp-x.ts";
import { stamp as stampY } from "./resume/bridge-stamp-y.ts";
import { stamp as stampZ } from "./resume/bridge-stamp-z.ts";

function inc(s: { (): number; set(v: number): void }) {
  s.set(s() + 1);
}
const config = { mode: "dark" };
_rMod(() => inc, "m.tsx#inc$ref");
_rMod(() => config, "m.tsx#config$ref");

test("a module reference encodes once, without captures, in objects, arrays, Maps and signals", async () => {
  const { state, values } = await roundTrip(() => [{ inc }, [inc], new Map([["k", inc]]), signal(inc)], {
    "m.tsx#inc$ref": () => "browser-inc",
  });
  const refs = state.t.filter((e) => e !== null && typeof e === "object" && (e as { f?: unknown }).f === "m.tsx#inc$ref");
  assert.equal(refs.length, 1);
  assert.deepEqual((refs[0] as { a: number[] }).a, []);
  const [obj, arr, map, sig] = values as [{ inc: unknown }, unknown[], Map<string, unknown>, () => unknown];
  assert.equal(obj.inc, "browser-inc");
  assert.equal(arr[0], "browser-inc");
  assert.equal(map.get("k"), "browser-inc");
  assert.equal(sig(), "browser-inc");
});

test("an imported object stamped with _rMod is a reference (browser module identity), not a copy", async () => {
  const { values } = await roundTrip(() => [{ config }], { "m.tsx#config$ref": () => "browser-config" });
  assert.equal((values[0] as { config: unknown }).config, "browser-config");
});

test("a per-render _rFn on a module reference keeps the module id", async () => {
  const { state } = await roundTrip(() => [_rFn("m.tsx#Page$a1", inc, [])], { "m.tsx#inc$ref": () => 0 });
  assert.ok(state.t.some((e) => (e as { f?: unknown } | null)?.f === "m.tsx#inc$ref"));
  assert.ok(!state.t.some((e) => (e as { f?: unknown } | null)?.f === "m.tsx#Page$a1"));
});

// T3 fix M4: only functions and static data are referable — an object holding signals (module-level store) goes by value,
// so the server-written signal values reach the browser; signals / computeds themselves and primitives get no stamp.
const store = { count: signal(1) };
_rMod(() => store, "m.tsx#store$ref");
const count = signal(2);
_rMod(() => count, "m.tsx#count$ref");
_rMod(() => "text", "m.tsx#text$ref", 1);
const icon = [["path", { d: "M0 0" }]] as const;
_rMod(() => icon, "lucide#Check$ref", 1);

test("a stamped object holding a signal goes by value; signals and primitives are no references; static data is", async () => {
  const symbols = { "m.tsx#store$ref": () => "browser-store", "m.tsx#count$ref": () => "browser-count", "lucide#Check$ref": () => "browser-icon" };
  const { state, values } = await roundTrip(() => [{ store, count, icon }], symbols);
  const [v] = values as [{ store: { count: () => unknown }; count: () => unknown; icon: unknown }];
  assert.equal(v.store.count(), 1);
  assert.equal(v.count(), 2);
  assert.equal(v.icon, "browser-icon");
  assert.ok(
    state.t.some((e) => e !== null && typeof e === "object" && "s" in (e as object)),
    "signal entries by value",
  );
  assert.ok(!state.t.some((e) => /store|count/.test(String((e as { f?: unknown } | null)?.f ?? ""))));
});

// T3 fix H3: the epilogue passes thunks; a binding still in its TDZ (import cycle: `export const` of a module evaluated after
// its importer) is read again at the next drain instead of throwing at module load.
test("a stamp whose binding is still in its TDZ is read at a later render", async () => {
  _rMod(() => late, "src/b.tsx#late$ref", 1);
  const early = await roundTrip(() => [1]);
  assert.deepEqual(early.values, [1]);
  // eslint-disable-next-line prefer-const
  let late = () => 1;
  const { values } = await roundTrip(() => [late], { "src/b.tsx#late$ref": () => "browser-late" });
  assert.deepEqual(values, ["browser-late"]);
});

// Review M2: one value stamped by several modules (a package export imported by two resume modules) keeps the smallest
// id whatever the module evaluation order, so the same page encodes the same state in every process.
function shared1() {}
function shared2() {}
_rMod(() => shared1, "b.tsx#shared$ref");
_rMod(() => shared1, "a.tsx#shared$ref");
_rMod(() => shared2, "a.tsx#shared$ref");
_rMod(() => shared2, "b.tsx#shared$ref");

test("several stamps of one value: the smallest id wins in either order", async () => {
  const symbols = { "a.tsx#shared$ref": () => "a", "b.tsx#shared$ref": () => "b" };
  const first = await roundTrip(() => [shared1], symbols);
  const second = await roundTrip(() => [shared2], symbols);
  assert.deepEqual(first.values, ["a"]);
  assert.equal(JSON.stringify(first.state), JSON.stringify(second.state));
  assert.equal(first.html, second.html);
});

// Function Bridge T3: imports carry one compiler id per imported value (`fake-util#double$ref`, flag 1) and an own-module
// stamp beats every import stamp, so a page's state does not depend on which importers (lazy routes) have loaded.
test("an own-module stamp wins over import stamps in either order", async () => {
  function own1() {}
  function own2() {}
  _rMod(() => own1, "src/util.tsx#own$ref");
  _rMod(() => own1, "src/util#own$ref", 1); // a lazy importer spelling `./util` (smaller id) loads later
  _rMod(() => own2, "src/util#own$ref", 1); // importer evaluated first (cycle)
  _rMod(() => own2, "src/util.tsx#own$ref");
  const symbols = { "src/util.tsx#own$ref": () => "own", "src/util#own$ref": () => "import" };
  const first = await roundTrip(() => [own1], symbols);
  const second = await roundTrip(() => [own2], symbols);
  assert.deepEqual(first.values, ["own"]);
  assert.equal(JSON.stringify(first.state), JSON.stringify(second.state));
});

test("the same page renders identical state before and after a lazy route importing the same values loads", async () => {
  function double() {}
  function local() {}
  // Route A (eager) at module load: `import { double } from "fake-util"` + its own module function.
  _rMod(() => local, "src/routes/a.tsx#local$ref");
  _rMod(() => double, "fake-util#double$ref", 1);
  const page = () => [{ double, local }];
  const symbols = { "fake-util#double$ref": () => "double", "src/routes/a.tsx#local$ref": () => "local" };
  const before = await roundTrip(page, symbols);
  // Lazy route B loads (request order): it imports the same export (same canonical id) and A's function through `./a`.
  _rMod(() => double, "fake-util#double$ref", 1);
  _rMod(() => local, "src/routes/a#local$ref", 1);
  const after = await roundTrip(page, symbols);
  assert.deepEqual(after.values, [{ double: "double", local: "local" }]);
  assert.equal(JSON.stringify(after.state), JSON.stringify(before.state));
  assert.equal(after.html, before.html);
});

// T3 fix round 2: an object with an accessor is no reference (by value) and its getter never runs while deciding.
let getterRuns = 0;
const withGetter = {
  get mode() {
    getterRuns++;
    return "dark";
  },
};
_rMod(() => withGetter, "m.tsx#withGetter$ref");

test("a stamped object with an accessor is not a module reference, and deciding never runs the getter", async () => {
  const { state } = await roundTrip(() => [1], {});
  assert.equal(getterRuns, 0);
  assert.ok(!state.t.some((e) => (e as { f?: unknown } | null)?.f === "m.tsx#withGetter$ref"));
});

// T3 fix round 3 (G1): a module evaluated twice before any render (dev edit while a request failed before rendering,
// a cache-busted copy) stamps one id from ONE module with its old and new value — a re-evaluation: the latest value is
// stamped too (never left out), no warning, and every later render resumes it.
test("one module stamping a new value for its id (re-evaluation): stamped, no warning, later renders keep working", async () => {
  const old = () => 1;
  const edited = () => 2;
  _rMod(() => old, "edit.tsx#v$ref");
  _rMod(() => edited, "edit.tsx#v$ref");
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    for (let i = 0; i < 2; i++) {
      const { values } = await roundTrip(() => [{ old, edited }], { "edit.tsx#v$ref": () => "browser-v" });
      assert.deepEqual(values[0], { old: "browser-v", edited: "browser-v" });
    }
    assert.equal(warn.mock.calls.length, 0);
  } finally {
    warn.mockRestore();
  }
});

// T3 fix round 3 (G1 / G2): one id on two values stamped by two different modules (two installed copies of a package) —
// in the same drain, or in a later one (a lazy route evaluated on a later request, a module imported while an async
// segment renders): development warns once per id naming both modules; every value stays stamped (production too).
test("one id on two values from two modules, in one drain or a later one: development warns once naming both; all stamped", async () => {
  const first = () => 1;
  const second = () => 2;
  const third = () => 3;
  const fourth = () => 4;
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    stampX(() => first, "dup.tsx#v$ref");
    stampY(() => second, "dup.tsx#v$ref");
    const same = await roundTrip(() => [{ first, second }], { "dup.tsx#v$ref": () => "browser-v" });
    assert.deepEqual(same.values[0], { first: "browser-v", second: "browser-v" });
    assert.equal(warn.mock.calls.length, DEV ? 1 : 0);
    if (DEV)
      assert.match(
        String(warn.mock.calls[0]![0]),
        /resume module reference dup\.tsx#v\$ref is stamped with two different values, by \S*bridge-stamp-x\.ts and \S*bridge-stamp-y\.ts — two installed copies/,
      );
    await roundTrip(() => [{ first }], { "dup.tsx#v$ref": () => "browser-v" });
    assert.equal(warn.mock.calls.length, DEV ? 1 : 0); // once per id
    // A later drain: `late.tsx#v$ref` stamped by x (drained by this render), then by y while an async child renders.
    stampX(() => fourth, "late.tsx#v$ref");
    await roundTrip(() => [{ fourth }], { "late.tsx#v$ref": () => "browser-late" });
    // The page records an effect (a page without resumable state writes no state, so nothing drains).
    const manifest = { runtime: "/rt.js", symbols: { [FX]: "/c.js" } };
    await resumableToString(
      () => {
        _rEffect(FX, []);
        return [
          Promise.resolve().then(() => {
            stampY(() => third, "late.tsx#v$ref");
            return "late";
          }),
        ] as never;
      },
      { manifest },
    );
    assert.equal(warn.mock.calls.length, DEV ? 2 : 0);
    if (DEV)
      assert.match(String(warn.mock.calls[1]![0]), /late\.tsx#v\$ref is stamped with two different values, by \S*bridge-stamp-x\.ts and \S*bridge-stamp-y\.ts/);
    const { values } = await roundTrip(() => [{ third }], { "late.tsx#v$ref": () => "browser-late" });
    assert.deepEqual(values[0], { third: "browser-late" });
  } finally {
    warn.mockRestore();
  }
});

// T3 fix round 4 (N1): two importers of one export (routes X and Y importing `inc` from utils.ts) stamp one id with the
// same value; an edit of utils.ts re-evaluates only the importer the next request renders (X) — a new value from a module
// that stamped the current one is a re-evaluation (replaced, no warning). Only a module outside that set stamping a
// different value (a second installed copy) warns, once per id, naming every module of the current value.
test("importers sharing a value, then one re-evaluating it: no warning; another module with a different value warns once", async () => {
  const v1 = () => 1;
  const v2 = () => 2;
  const v3 = () => 3;
  const v4 = () => 4;
  const browser = { "share.tsx#inc$ref": () => "browser-inc" };
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    stampX(() => v1, "share.tsx#inc$ref");
    stampY(() => v1, "share.tsx#inc$ref");
    assert.deepEqual((await roundTrip(() => [{ v1 }], browser)).values[0], { v1: "browser-inc" });
    stampX(() => v2, "share.tsx#inc$ref"); // utils.ts edited: X re-evaluated first
    assert.deepEqual((await roundTrip(() => [{ v2 }], browser)).values[0], { v2: "browser-inc" });
    stampY(() => v2, "share.tsx#inc$ref"); // Y re-evaluated on a later request: same new value
    await roundTrip(() => [{ v2 }], browser);
    assert.equal(warn.mock.calls.length, 0);
    // Two more edits: X re-evaluates first (v3), then the stale importer Y re-evaluates first (v4) — Y is still known.
    stampX(() => v3, "share.tsx#inc$ref");
    stampY(() => v4, "share.tsx#inc$ref");
    stampX(() => v4, "share.tsx#inc$ref");
    await roundTrip(() => [{ v4 }], browser);
    assert.equal(warn.mock.calls.length, 0);
    // The old value from a module that never stamped the current one: the current value is v2 (replaced), so this warns.
    stampZ(() => v1, "share.tsx#inc$ref");
    await roundTrip(() => [{ v1 }], browser);
    assert.equal(warn.mock.calls.length, DEV ? 1 : 0);
    if (DEV)
      assert.match(
        String(warn.mock.calls[0]![0]),
        /share\.tsx#inc\$ref is stamped with two different values, by \S*bridge-stamp-x\.ts, \S*bridge-stamp-y\.ts and \S*bridge-stamp-z\.ts — two installed copies/,
      );
    stampZ(() => v3, "share.tsx#inc$ref");
    stampX(() => v1, "share.tsx#inc$ref");
    await roundTrip(() => [{ v3 }], browser);
    assert.equal(warn.mock.calls.length, DEV ? 1 : 0); // once per id
  } finally {
    warn.mockRestore();
  }
});
