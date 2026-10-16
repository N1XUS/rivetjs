// Function Bridge T18 (Q5): a recipe const whose value holds only References encodes by value (initializer runs once).
import { test } from "vitest";
import assert from "node:assert/strict";
import { signal } from "@rivetjs/reactivity";
import { _rFn } from "@rivetjs/runtime/server-resume";
import { roundTrip } from "./resume/bridge-encode.ts";

const recipe = (state: { t: unknown[] }, id: string) => state.t.some((e) => (e as { f?: unknown } | null)?.f === id);

test("an array of symbols is data, not its recipe", async () => {
  let inits = 0;
  const { state, values } = await roundTrip(
    () => {
      const inner = _rFn("m.tsx#P$inc", () => 1, []);
      return [_rFn("m.tsx#P$fns", [inner], [])];
    },
    { "m.tsx#P$inc": () => () => "inc", "m.tsx#P$fns": () => (inits++, ["recipe"]) },
  );
  assert.equal(inits, 0);
  assert.ok(!recipe(state, "m.tsx#P$fns"));
  assert.equal((values[0] as [() => string])[0](), "inc");
});

test("a recipe const of plain data (no functions) goes by value", async () => {
  const { state, values } = await roundTrip(() => [_rFn("m.tsx#P$rows", [{ id: 1, label: "a" }], [])], { "m.tsx#P$rows": () => ["recipe"] });
  assert.ok(!recipe(state, "m.tsx#P$rows"));
  assert.deepEqual(values[0], [{ id: 1, label: "a" }]);
});

test("a recipe const holding signals still goes by value", async () => {
  const { state } = await roundTrip(() => [_rFn("m.tsx#P$sig", { n: signal(1) }, [])], { "m.tsx#P$sig": () => ["recipe"] });
  assert.ok(!recipe(state, "m.tsx#P$sig"));
});

test("a recipe const holding an unstamped function keeps its recipe", async () => {
  const { state } = await roundTrip(() => [_rFn("m.tsx#P$opaque", [() => 2], [])], { "m.tsx#P$opaque": () => ["r"] });
  assert.ok(recipe(state, "m.tsx#P$opaque"));
});

test("a recipe id whose value failed once goes straight to its recipe (process-wide)", async () => {
  await roundTrip(() => [_rFn("m.tsx#P$once", [() => 2], [])], { "m.tsx#P$once": () => ["r"] });
  // Same recipe id, encodable value this time: remembered as recipe-only (one failed attempt per process).
  const { state, values } = await roundTrip(() => [_rFn("m.tsx#P$once", ["data"], [])], { "m.tsx#P$once": () => ["r"] });
  assert.ok(recipe(state, "m.tsx#P$once"));
  assert.deepEqual(values[0], ["r"]);
});
