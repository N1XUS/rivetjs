import { test } from "vitest";
import assert from "node:assert/strict";
import { signal, computed, effect, _inspect } from "@rivetjs/reactivity";
import { _trackReads } from "@rivetjs/reactivity/track";

test("_trackReads reports signals read directly and through computeds, deduped in first-read order", () => {
  const a = signal(1),
    b = signal(2),
    c = signal(3);
  const sum = computed(() => b() + c());
  const { value, signals } = _trackReads(() => a() + sum() + a() + b());
  assert.equal(value, 1 + 5 + 1 + 2);
  assert.deepEqual(signals, [a, b, c]);
});

test("_trackReads does not subscribe the caller or leave the collector subscribed", () => {
  const a = signal(1);
  let runs = 0;
  effect(() => {
    runs++;
    _trackReads(() => a());
  });
  a.set(2);
  assert.equal(runs, 1);
  const nested = _trackReads(() => _trackReads(() => a()).signals.length);
  assert.deepEqual(nested, { value: 1, signals: [] });
});

test("_inspect classifies signals and computeds without reading", () => {
  const a = signal(5);
  let reads = 0;
  const c = computed(() => (reads++, a()));
  assert.deepEqual(_inspect(a), { kind: "signal", value: 5, equals: Object.is });
  assert.deepEqual(_inspect(c), { kind: "computed", equals: Object.is });
  const cmp = (x: number, y: number) => x === y;
  assert.equal(_inspect(signal(0, { equals: false }))!.equals, null);
  assert.equal(_inspect(computed(() => 1, { equals: cmp }))!.equals, cmp);
  assert.equal(reads, 0);
  assert.equal(
    _inspect(() => 1),
    null,
  );
  assert.equal(_inspect(1), null);
});

test("_trackReads dedupes past the scan threshold in first-read order and shares a frozen empty result", () => {
  const many = Array.from({ length: 40 }, (_, i) => signal(i));
  const { signals } = _trackReads(() => {
    let sum = 0;
    for (let round = 0; round < 3; round++) for (const s of many) sum += s();
    return sum;
  });
  assert.deepEqual(signals, many);
  const none = _trackReads(() => 1).signals,
    again = _trackReads(() => 2).signals;
  assert.equal(none.length, 0);
  assert.equal(none, again);
  assert.ok(Object.isFrozen(none));
  // Through a diamond of computeds: each leaf once, depth-first in first-read order.
  const a = signal(1),
    b = signal(2),
    c = signal(3);
  const left = computed(() => a() + b()),
    right = computed(() => b() + c()),
    both = computed(() => left() + right());
  assert.deepEqual(_trackReads(() => both() + c() + left()).signals, [a, b, c]);
  // A computed that reads nothing reports no signals.
  const constant = computed(() => 1);
  assert.equal(_trackReads(() => constant()).signals, none);
  // More than the scan threshold of distinct leaves below computeds.
  const sums = Array.from({ length: 20 }, (_, i) => computed(() => many[i]!() + many[i + 20]!()));
  const expected = sums.flatMap((_, i) => [many[i], many[i + 20]]);
  assert.deepEqual(_trackReads(() => sums.reduce((n, s) => n + s() + s(), 0)).signals, expected);
});
