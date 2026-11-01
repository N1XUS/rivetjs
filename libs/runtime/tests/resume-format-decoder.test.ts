import assert from "node:assert/strict";
import { test } from "vitest";
import { createEncoder, createDecoder } from "../resume-format.ts";

const roundTrip = (value: unknown, json: boolean) => {
  const { ref, table } = createEncoder({ json });
  const root = ref(value);
  return createDecoder(JSON.parse(JSON.stringify(table))).get(root);
};

// An own "__proto__" key (route data parsed from JSON, a signal value built with defineProperty) stays an own data
// property: assigning it would set the decoded object's prototype instead.
test("an own __proto__ key round-trips as data, never as the prototype", () => {
  for (const json of [true, false])
    for (const value of [JSON.parse('{"__proto__":{"x":1},"a":2}'), Object.assign(JSON.parse('{"__proto__":{"x":1}}'), { d: new Date(0) })]) {
      const out = roundTrip(value, json) as Record<string, unknown>;
      assert.equal(Object.getPrototypeOf(out), Object.prototype, `json: ${json}`);
      assert.ok(Object.hasOwn(out, "__proto__"));
      assert.deepEqual(Object.getOwnPropertyDescriptor(out, "__proto__")!.value, { x: 1 });
      assert.equal((out as { x?: unknown }).x, undefined, "no inherited x from a swapped prototype");
      assert.equal(({} as { x?: unknown }).x, undefined, "Object.prototype untouched");
    }
});

test("a table entry that points into a parent's missing, inherited or primitive key throws", () => {
  for (const table of [
    [{ i: [1, "missing"] }, { j: { a: 1 } }],
    [{ i: [1, "toString"] }, { j: {} }],
    [{ i: [1, "__proto__"] }, { j: {} }],
    [{ i: [1, "a"] }, 5],
    [{ i: [1, "a"] }, null],
  ])
    assert.throws(() => createDecoder(table).get(0), { name: "TypeError", message: "Invalid resume table entry" }, JSON.stringify(table));
  // The same shape with an own key decodes.
  assert.equal(createDecoder([{ i: [1, "a"] }, { j: { a: 7 } }]).get(0), 7);
});
