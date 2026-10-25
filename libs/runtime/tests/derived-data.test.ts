// Derived model, route payload (DERIVED-S 2026-10-21): `_rData` (`@rivetjs/runtime/server-derived`, called by the router's
// generated `entry.server.tsx` for its `Root` props) keeps JSON data as it is and encodes anything else the resume table
// supports (`{ t, r }`, the router's data-endpoint wire) — so `Root` stays an independent boundary with props and the page
// resumes — while what the table cannot encode warns RV2107 once and demotes `Root` (today's behaviour). The browser half
// is the generated `Root`'s `rootPayload` (`createDecoder`) + `Root.ready` (`resume-builtins` for built-in entries),
// replayed here per shape.
import { test } from "vitest";
import assert from "node:assert/strict";
import { expandTail } from "@rivetjs/runtime/resume-format";
import { _rB, _rBEnd, _rBOut, _rData, derivedToString } from "@rivetjs/runtime/server-derived";
import { createDecoder, registerClass, serialize } from "@rivetjs/runtime/resume-format";
import type { FlushTail } from "@rivetjs/runtime/resume-format";

const INDEPENDENT = 1,
  DEMOTED = 8;
const manifest = { hash: "t", runtime: "/rt.js", symbols: {} as Record<string, string>, builtins: "/assets/resume-builtins.js" };
class Money {
  cents: number;
  constructor(cents: number) {
    this.cents = cents;
  }
}
registerClass(Money, { id: "test-money", serialize: (m) => m.cents, revive: (c) => new Money(c as number) });
class Own {
  v: number;
  constructor(v: number) {
    this.v = v;
  }
  [serialize]() {
    return this.v;
  }
}
class Plain {
  x = 1;
}

// The router's shape: `<Root s={rootData(input)} />`, Root's body opening the independent boundary with its props.
async function render(payload: object, origin?: string): Promise<{ record: FlushTail["b"][number]; html: string }> {
  const html = (await derivedToString(
    () => {
      const props = { s: _rData(payload) };
      const B = _rB("Root", INDEPENDENT, props);
      try {
        return _rBOut(B, "<p>root</p>");
      } finally {
        _rBEnd(B);
      }
    },
    { manifest, ...(origin ? { origin } : {}) } as never,
  )) as string;
  const tail = expandTail(JSON.parse(/<script type="rivet\/boundaries"[^>]*>(.*?)<\/script>/s.exec(html)![1]!));
  return { record: tail.b[0]!, html };
}
// The generated browser `Root`: `Root.ready` loads the chunk the payload names (`x`, here the module itself), `rootPayload`
// decodes.
async function browser(s: unknown): Promise<unknown> {
  const wire = s as { t?: unknown[]; r?: number; x?: string };
  if (wire.t === undefined) return s;
  if (wire.x !== undefined) await import("@rivetjs/runtime/resume-builtins");
  return createDecoder(wire.t).get(wire.r!);
}
async function roundTrip(payload: object, origin?: string): Promise<{ value: unknown; encoded: boolean }> {
  const { record } = await render(payload, origin);
  assert.equal(record[2]! & (INDEPENDENT | DEMOTED), INDEPENDENT, "Root keeps its props (not demoted)");
  const s = (record[5] as { s: unknown }).s;
  if ((s as { t?: unknown }).t !== undefined) assert.equal((s as { x?: string }).x, undefined, "no built-in entries: no decoders chunk");
  return { value: await browser(s), encoded: (s as { t?: unknown }).t !== undefined };
}

test("JSON data: kept as it is (no table), the record as before", async () => {
  const payload = { d: [{ title: "x <y>", rows: [{ id: 1, values: [1, 2] }] }, null], n: [1], x: [0] };
  const { value, encoded } = await roundTrip(payload);
  assert.equal(encoded, false);
  assert.deepEqual(value, payload);
});

test("per shape: Date, Map, Set, BigInt, undefined, special numbers, URL, cycles survive", async () => {
  const cyclic: Record<string, unknown> = { name: "c" };
  cyclic.self = cyclic;
  const shapes: [string, unknown, (back: unknown) => void][] = [
    ["Date", new Date(86_400_000), (b) => assert.equal((b as Date).toISOString(), "1970-01-02T00:00:00.000Z")],
    [
      "Map",
      new Map<unknown, unknown>([
        ["a", 1],
        [2, { b: true }],
      ]),
      (b) =>
        assert.deepEqual(
          [...(b as Map<unknown, unknown>)],
          [
            ["a", 1],
            [2, { b: true }],
          ],
        ),
    ],
    ["Set", new Set([1, "two"]), (b) => assert.deepEqual([...(b as Set<unknown>)], [1, "two"])],
    ["BigInt", 2n ** 70n, (b) => assert.equal(b, 2n ** 70n)],
    [
      "undefined",
      { a: undefined, list: [undefined, 1] },
      (b) => (assert.ok("a" in (b as object)), assert.deepEqual(b, { a: undefined, list: [undefined, 1] })),
    ],
    ["numbers", [NaN, Infinity, -Infinity, -0], (b) => assert.ok(Object.is((b as number[])[0], NaN) && Object.is((b as number[])[3], -0))],
    ["URL", new URL("https://cdn.example/a?b=1"), (b) => assert.equal((b as URL).href, "https://cdn.example/a?b=1")],
    ["cycle", cyclic, (b) => assert.equal((b as Record<string, unknown>).self, b)],
  ];
  for (const [name, value, check] of shapes) {
    const { value: back, encoded } = await roundTrip({ d: [{ value }] });
    assert.equal(encoded, true, name);
    check((back as { d: { value: unknown }[] }).d[0]!.value);
  }
});

test("per shape: built-in entries (RegExp, URLSearchParams, binary, errors) and registerClass instances name the decoders' chunk (manifest `builtins`) and decode after it", async () => {
  const shapes: [string, unknown, (back: unknown) => void][] = [
    ["RegExp", /a+b/gi, (b) => assert.equal(String(b), "/a+b/gi")],
    ["URLSearchParams", new URLSearchParams("a=1&b=2"), (b) => assert.equal(String(b), "a=1&b=2")],
    ["Uint8Array", new Uint8Array([1, 2, 255]), (b) => assert.deepEqual([...(b as Uint8Array)], [1, 2, 255])],
    ["Error", new TypeError("bad"), (b) => (assert.ok(b instanceof TypeError), assert.equal((b as Error).message, "bad"))],
    ["registerClass", new Money(1234), (b) => (assert.ok(b instanceof Money), assert.equal((b as Money).cents, 1234))],
  ];
  for (const [name, value, check] of shapes) {
    const { record } = await render({ d: [value] });
    const s = (record[5] as { s: { t: unknown[]; x?: string } }).s;
    assert.equal(s.x, manifest.builtins, name + ": `Root.ready` loads the built-in decoders");
    check(((await browser(s)) as { d: unknown[] }).d[0]);
  }
});

test("shared references: JSON data ships as JSON (copies, the fast path); next to an encoded value they stay one object", async () => {
  const shared = { id: 7 };
  const json = await roundTrip({ d: [shared, shared] });
  assert.equal(json.encoded, false);
  assert.deepEqual(json.value, { d: [{ id: 7 }, { id: 7 }] });
  const table = await roundTrip({ d: [shared, shared, new Date(0)] });
  assert.equal(table.encoded, true);
  const d = (table.value as { d: unknown[] }).d;
  assert.equal(d[0], d[1]);
});

test("same-origin URLs ship relative to the request origin (as router data and the serialized state)", async () => {
  const { record } = await render({ d: [new URL("https://shop.test/p/1?x=2")] }, "https://shop.test");
  assert.doesNotMatch(JSON.stringify(record[5]), /shop\.test/);
});

test("RV2107: functions, symbols, unregistered or symbol-only classes warn once and demote Root (the page does not resume)", async () => {
  const warn = console.warn,
    seen: string[] = [];
  console.warn = (message: string) => void seen.push(message);
  try {
    for (const value of [() => 1, Symbol("s"), new Plain(), new Own(3), Promise.resolve(1)]) {
      const { record } = await render({ d: [{ value }] });
      assert.equal(record[2]! & (INDEPENDENT | DEMOTED), DEMOTED);
      assert.equal(record[5], undefined, "no props");
    }
    await render({ d: [{ value: () => 2 }] });
  } finally {
    console.warn = warn;
  }
  assert.equal(seen.length, 5, "once per message:\n" + seen.join("\n"));
  for (const message of seen) assert.match(message, /^\[RV2107\] Route data cannot resume \(derived model\): .+ The page renders but does not resume\./);
  assert.match(seen[2]!, /Plain instance is not serializable/);
});
