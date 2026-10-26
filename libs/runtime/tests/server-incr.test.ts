// INCR2: incremental server lists (`@rivetjs/runtime/server-incr`, `$incr` facts from the compiler's `incr` option).
// Differential: under random mutations (field edits, replaced rows, inserts, removals, reorders, 0–100% changes) a render
// through the cache is byte-identical to a cold render, tail included; plus verify mode, duplicate keys, non-plain items,
// the fact's state contract (a row registering state its fact does not list is an internal error) and cache bounds.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import { createIncrCache } from "@rivetjs/runtime/server-incr";
import { importServer } from "./resume/compile.ts";

const it = hasDerivedModel() ? test : test.skip;
// Block-body rows (plain `For`, a keyed row signal) and expression-body rows (`_rFor`, the list tape).
const SOURCE = `
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
export function List(props) {
  const filter = signal("");
  return (
    <main>
      <input model:value={filter} />
      <table><tbody>
        <For each={() => props.rows.filter((r) => r.title.includes(filter()))} by={(r) => r.id}>
          {(row) => {
            const open = signal(false);
            return (
              <tr class={row().done ? "done" : "todo"}>
                <td>{row().n}</td><td title={row().title}>{row().title}</td>
                <td><button onClick={() => open.update((v) => !v)}>{open() ? "Hide" : "Show"}</button></td>
              </tr>
            );
          }}
        </For>
      </tbody></table>
      <ul><For each={() => props.rows} by={(r) => r.id}>{(row, i) => <li data-i={i()}>{row().owner} {row().n * 2}</li>}</For></ul>
    </main>
  );
}
`;
const manifest = { hash: "t", runtime: "/rt.js", symbols: { "m#List": "/m.js" } };
interface Row {
  readonly id: string;
  readonly title: string;
  readonly owner: string;
  readonly done: boolean;
  readonly n: number;
}

async function load(transform: (code: string) => string = (c) => c) {
  const out = compile(SOURCE, { target: "server", filename: "m.tsx", resume: { module: "m", boundaries: ["List"], independent: ["List"] }, incr: true });
  assert.deepEqual(out.diagnostics, []);
  assert.equal(out.code.match(/"\$incr": __rivetIncr/g)?.length, 2, "both lists proven");
  return (await importServer<{ List: (props: { rows: readonly Row[] }) => ServerValue }>(transform(out.code))).List;
}

// Deterministic PRNG (mulberry32).
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const make = (i: number, v: number): Row =>
  Object.freeze({
    id: "r" + i,
    title: "Task <" + i + "> " + (v ? "v" + v : "") + (i % 7 === 0 ? " é " : ""),
    owner: "o" + (i % 5),
    done: (i + v) % 3 === 0,
    n: i + v,
  });

function mutate(rows: Row[], random: () => number, step: number): Row[] {
  const list = rows.slice();
  const kind = Math.floor(random() * 6);
  const pct = [0, 0.5, 1, 5, 10, 50, 100][Math.floor(random() * 7)]!;
  const n = Math.round((list.length * pct) / 100);
  for (let j = 0; j < n; j++) {
    const k = Math.floor(random() * list.length);
    list[k] = make(Number(list[k]!.id.slice(1)), step);
  }
  if (kind === 1) list.splice(Math.floor(random() * list.length), 0, make(1000 + step, step));
  if (kind === 2 && list.length > 1) list.splice(Math.floor(random() * list.length), 1);
  if (kind === 3 && list.length > 1) {
    const a = Math.floor(random() * list.length),
      b = Math.floor(random() * list.length);
    [list[a], list[b]] = [list[b]!, list[a]!];
  }
  return list;
}

it("differential: random mutations through the cache == cold renders, byte for byte (tail included)", async () => {
  const List = await load();
  const cache = createIncrCache();
  const verified = createIncrCache({ verify: true });
  const random = rng(7);
  let rows = Array.from({ length: 120 }, (_, i) => make(i, 0));
  for (let step = 1; step <= 160; step++) {
    rows = mutate(rows, random, step);
    const props = { rows: Object.freeze(rows.slice()) };
    const cold = await derivedToString(() => List(props), { manifest });
    assert.equal(await derivedToString(() => List(props), { manifest, incr: cache } as never), cold, "step " + step);
    assert.equal(await derivedToString(() => List(props), { manifest, incr: verified } as never), cold, "verify step " + step);
  }
  const stats = cache.stats();
  assert.ok(stats.hits > stats.misses, JSON.stringify(stats));
  assert.equal(verified.stats().mismatches, 0);
  // Partitions keep lists apart; clear empties the cache.
  assert.ok(stats.lists >= 2 && stats.bytes > 0, JSON.stringify(stats));
  cache.clear();
  assert.equal(cache.stats().lists, 0);
});

it("unchanged lists: every row from the cache; a 1% change re-renders only the changed rows", async () => {
  const List = await load();
  const cache = createIncrCache();
  const rows = Array.from({ length: 200 }, (_, i) => make(i, 0));
  const render = (list: readonly Row[]) => derivedToString(() => List({ rows: list }), { manifest, incr: cache } as never);
  await render(rows);
  const warm = cache.stats();
  assert.equal(await render(rows), await derivedToString(() => List({ rows }), { manifest }));
  assert.equal(cache.stats().hits - warm.hits, 400);
  const next = rows.slice();
  next[10] = make(10, 3);
  next[150] = make(150, 3);
  const before = cache.stats();
  assert.equal(await render(next), await derivedToString(() => List({ rows: next }), { manifest }));
  assert.equal(cache.stats().misses - before.misses, 4);
  assert.equal(cache.stats().hits - before.hits, 396);
});

it("moved, inserted and removed rows keep their bytes (matched by key); index-reading rows re-render after the move", async () => {
  const List = await load();
  const cache = createIncrCache();
  let rows = Array.from({ length: 100 }, (_, i) => make(i, 0));
  const render = async (list: readonly Row[]) => {
    const before = cache.stats();
    const html = await derivedToString(() => List({ rows: list }), { manifest, incr: cache } as never);
    assert.equal(html, await derivedToString(() => List({ rows: list }), { manifest }));
    const after = cache.stats();
    return { hits: after.hits - before.hits, misses: after.misses - before.misses };
  };
  await render(rows);
  // Prepend: the block-body list (key-matched) renders one row, the other 100 from the cache; the index list (`x: 1`:
  // positional only) starts over, all 101 rows.
  rows = [make(500, 1), ...rows];
  const prepend = await render(rows);
  assert.deepEqual(prepend, { hits: 100, misses: 1 + 101 });
  // Remove two, swap two.
  rows = rows.filter((_, i) => i !== 5 && i !== 50);
  [rows[1], rows[90]] = [rows[90]!, rows[1]!];
  const moved = await render(rows);
  assert.deepEqual(moved, { hits: 99, misses: 99 });
});

it("duplicate keys throw like the cold render; non-plain items render cold", async () => {
  const List = await load();
  const cache = createIncrCache();
  const rows = Array.from({ length: 50 }, (_, i) => make(i, 0));
  await derivedToString(() => List({ rows }), { manifest, incr: cache } as never);
  const dup = rows.slice();
  dup[3] = make(4, 1);
  const cold = await Promise.resolve()
    .then(() => derivedToString(() => List({ rows: dup }), { manifest }))
    .catch((e: Error) => e.message);
  const warm = await Promise.resolve()
    .then(() => derivedToString(() => List({ rows: dup }), { manifest, incr: cache } as never))
    .catch((e: Error) => e.message);
  assert.equal(warm, cold);
  assert.match(String(cold), /Duplicate For key/);
  class Item {
    declare readonly id: string;
    declare readonly title: string;
    declare readonly owner: string;
    declare readonly done: boolean;
    declare readonly n: number;
    constructor(row: Row) {
      Object.assign(this, row);
    }
  }
  const classed = rows.map((r) => new Item(r)) as unknown as Row[];
  for (let k = 0; k < 3; k++) {
    const html = await Promise.resolve()
      .then(() => derivedToString(() => List({ rows: classed }), { manifest, incr: cache } as never))
      .catch((e: Error) => e.message);
    const plain = await Promise.resolve()
      .then(() => derivedToString(() => List({ rows: classed }), { manifest }))
      .catch((e: Error) => e.message);
    assert.equal(html, plain);
  }
});

it("a row registering state its fact does not list is an internal error (the compiler proof is checked)", async () => {
  // The block-body list's fact with its keyed row signal removed: rendering a miss registers a signal the fact hides.
  const List = await load((code) => code.replace(/s: \["[0-9a-z]{5}-\d+", false\]/, "s: []"));
  const cache = createIncrCache();
  const rows = Array.from({ length: 20 }, (_, i) => make(i, 0));
  await assert.rejects(async () => derivedToString(() => List({ rows }), { manifest, incr: cache } as never), /Internal error: an incremental list row/);
});

it("bounded: lists beyond maxLists / maxBytes are evicted (LRU)", async () => {
  const List = await load();
  const cache = createIncrCache({ maxLists: 2 });
  for (let p = 0; p < 6; p++) {
    const rows = Array.from({ length: 30 }, (_, i) => make(i + p * 100, p));
    await derivedToString(() => List({ rows }), { manifest, incr: cache, incrPartition: "u" + p } as never);
  }
  const stats = cache.stats();
  assert.ok(stats.lists <= 2, JSON.stringify(stats));
  assert.ok(stats.evictions > 0);
  const tiny = createIncrCache({ maxBytes: 1024 });
  const rows = Array.from({ length: 100 }, (_, i) => make(i, 0));
  await derivedToString(() => List({ rows }), { manifest, incr: tiny } as never);
  assert.ok(tiny.stats().bytes <= 1024, JSON.stringify(tiny.stats()));
});
