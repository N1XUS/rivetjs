// Function Bridge T7: `let` cells (`_rCell`) are shared by every capture, encoded at their first encode (Q2).
import { test } from "vitest";
import assert from "node:assert/strict";
import { _rCell, _rFn, renderResumable } from "@rivetjs/runtime/server-resume";
import { createDecoder } from "@rivetjs/runtime/resume-format";
import { roundTrip } from "./resume/bridge-encode.ts";
import { compileResume, importServer } from "./resume/compile.ts";

const DEV_RUN = process.execArgv.includes("--conditions=development");

test("one cell captured twice decodes to one browser cell with the value at encode", async () => {
  const { values } = await roundTrip(() => {
    const clicks = _rCell(0);
    clicks.v = 2;
    return [clicks, { clicks }];
  });
  const [a, b] = values as [{ v: number }, { clicks: { v: number } }];
  assert.equal(a.v, 2);
  assert.equal(b.clicks, a);
  a.v++;
  assert.equal(b.clicks.v, 3);
});

test("a cell holding a function that captures the cell decodes (two-phase)", async () => {
  const { values } = await roundTrip(
    () => {
      const cell = _rCell<unknown>(null);
      cell.v = _rFn("m.tsx#P$g", () => cell, [cell]);
      return [cell];
    },
    { "m.tsx#P$g": (cell: never) => () => cell },
  );
  const cell = values[0] as { v: () => unknown };
  assert.equal(cell.v(), cell);
});

test("a server write after the first encode keeps the encoded value; dev warns", async () => {
  const warnings: unknown[] = [];
  const warn = console.warn;
  console.warn = (...args: unknown[]) => void (/captured `let`/.test(String(args[0])) ? warnings.push(args) : warn(...args));
  let late: { v: number } | undefined;
  try {
    const { values } = await roundTrip(() => {
      late = _rCell(1);
      return [late];
    });
    late!.v = 5;
    assert.equal((values[0] as { v: number }).v, 1);
  } finally {
    console.warn = warn;
  }
  assert.equal(warnings.length, DEV_RUN ? 1 : 0);
});

test("a function reached before the cell holding it decodes; the cell gets it once the function is done", async () => {
  const { values } = await roundTrip(
    () => {
      const cell = _rCell<unknown>(null);
      const g = _rFn("m.tsx#P$g", () => cell, [cell]);
      cell.v = g;
      return [g, cell];
    },
    { "m.tsx#P$g": (cell: never) => () => cell },
  );
  const [g, cell] = values as [() => unknown, { v: unknown }];
  assert.equal(g(), cell);
  assert.equal(cell.v, g);
});

test("a late capture thunk (T5) holding a cell: the cell's value at the thunk's encode", async () => {
  const { values } = await roundTrip(
    () => {
      const count = _rCell(0);
      const f = _rFn(
        "m.tsx#P$f",
        () => count.v,
        () => [count],
      );
      count.v = 7;
      return [f, count];
    },
    { "m.tsx#P$f": (count: never) => () => (count as { v: number }).v },
  );
  const [f, count] = values as [() => number, { v: number }];
  assert.equal(f(), 7);
  count.v = 8;
  assert.equal(f(), 8);
});

// Indirect cycles (fix round 1): a cell reached anywhere inside a decoding function / computed / custom entry gets its
// value once the outermost one is done, so every cycle through a cell decodes, from any end.
const G = "m.tsx#P$g",
  F = "m.tsx#P$f";
const factories = { [G]: (f: never) => () => f, [F]: (cell: never) => () => cell };
async function indirect(order: (f: unknown, cell: unknown, g: unknown) => unknown[]) {
  // `let h = () => f(); const f = () => h.v();` — F captures the cell, the cell holds G, G captures F.
  const { values } = await roundTrip(() => {
    const cell = _rCell<unknown>(null);
    const f = _rFn(F, () => cell, [cell]);
    cell.v = _rFn(G, () => f, [f]);
    return order(f, cell, cell.v);
  }, factories);
  return values;
}
const check = (f: () => unknown, cell: { v: () => unknown }) => {
  assert.equal(f(), cell);
  assert.equal(cell.v(), f);
};
test("an indirect cycle function → cell → function → function decodes from the outer function", async () => {
  const [f, cell] = (await indirect((f, cell) => [f, cell])) as [() => unknown, { v: () => unknown }];
  check(f, cell);
});
test("an indirect cycle decodes from the cell", async () => {
  const [cell, f] = (await indirect((f, cell) => [cell, f])) as [{ v: () => unknown }, () => unknown];
  check(f, cell);
});
test("an indirect cycle decodes from the inner function", async () => {
  const [g, f, cell] = (await indirect((f, cell, g) => [g, f, cell])) as [() => unknown, () => unknown, { v: () => unknown }];
  check(f, cell);
  assert.equal(g, cell.v);
});

test("a function in an object inside the cell, capturing the cell, decodes from either end", async () => {
  for (const fromFunction of [true, false]) {
    const { values } = await roundTrip(
      () => {
        const cell = _rCell<unknown>(null);
        const f = _rFn(F, () => cell, [cell]);
        cell.v = { cb: f };
        return fromFunction ? [f, cell] : [cell, f];
      },
      { [F]: factories[F] },
    );
    const [f, cell] = (fromFunction ? values : [values[1], values[0]]) as [() => unknown, { v: { cb: unknown } }];
    assert.equal(f(), cell);
    assert.equal(cell.v.cb, f);
  }
});

// L4: later streamed segments reaching a cell encoded earlier reuse its entry, also after a server write (dev warns once).
const STREAM = `
import { Async } from "@rivetjs/runtime/server";
import { _rCell, _rEffect } from "@rivetjs/runtime/server-resume";
const later = (ms, value) => new Promise((resolve) => setTimeout(() => resolve(value), ms));
export function Page() {
  const cell = _rCell(1);
  return <main>
    <Async load={() => later(5, "a")} fallback={() => <i>a</i>}>{(v) => (_rEffect("m.tsx#P$fx", [cell]), <em>{v}</em>)}</Async>
    <Async load={() => later(30, "b").then((x) => ((cell.v = 2), x))} fallback={() => <i>b</i>}>{(v) => (_rEffect("m.tsx#P$fx", [cell]), <b>{v}</b>)}</Async>
  </main>;
}
`;
test("streamed: later segments reuse the cell entry after a server write (Q2)", async () => {
  const symbols = compileResume(STREAM, "dom").symbols;
  const manifest = { runtime: "/rt.js", symbols: Object.fromEntries([...symbols.map((s) => s.id), "m.tsx#P$fx"].map((id) => [id, "/c.js"])) };
  const mod = await importServer<{ Page(): never }>(compileResume(STREAM, "server").code);
  const warnings: unknown[] = [];
  const warn = console.warn;
  console.warn = (...args: unknown[]) => void (/captured `let`/.test(String(args[0])) ? warnings.push(args) : warn(...args));
  const chunks: string[] = [];
  try {
    await renderResumable(() => mod.Page(), { write: (chunk) => void chunks.push(chunk) }, { manifest, stream: {} });
  } finally {
    console.warn = warn;
  }
  const html = chunks.join("");
  const shell = JSON.parse(/<script type="rivet\/state" data-region="0"[^>]*>(.*?)<\/script>/s.exec(html)![1]!) as { t: unknown[] };
  const patches = [...html.matchAll(/<script type="rivet\/state" data-patch="\d+">(.*?)<\/script>/gs)].map(
    (match) => JSON.parse(match[1]!) as { t: unknown[]; fx: [unknown, number[]][] },
  );
  assert.equal(patches.length, 2);
  // The Async regions capture the cell: the shell encodes it (value 1); both segments' effects reference that entry.
  const [first, second] = patches as [(typeof patches)[0], (typeof patches)[0]];
  const ref = first.fx[0]![1][0]!;
  assert.deepEqual(second.fx[0]![1], [ref], "the same table entry");
  assert.ok(!JSON.stringify([first.t, second.t]).includes("cell"), "no second cell entry");
  assert.equal((createDecoder(shell.t).get(ref) as { v: number }).v, 1, "the value at the first encode");
  assert.equal(warnings.length, DEV_RUN ? 1 : 0);
});

// Fix round 2 (round 4: the failed frame is rolled back whole, so the retry makes a new cell): a handler retried after a
// transient error (symbol not loaded yet) never sees `v === undefined`.
const fnHook = (fail: Set<string>) => (id: unknown, captures: unknown[]) => {
  if (fail.delete(id as string)) throw new Error("not loaded: " + String(id));
  return Object.assign(() => captures, { id });
};
test("a function hook throwing once: the queued cell gets its value on the retry", () => {
  for (const retry of ["function", "cell"]) {
    const decoder = createDecoder([{ f: "F", a: [1] }, { k: "cell", a: [2] }, 5], { fn: fnHook(new Set(["F"])) });
    assert.throws(() => decoder.get(0), /not loaded: F/);
    const cell = retry === "function" ? ((decoder.get(0) as () => unknown[])()[0] as { v: number }) : (decoder.get(1) as { v: number });
    assert.equal(cell.v, 5, retry);
    assert.equal(decoder.get(1), cell);
  }
});
// Fix round 3: a failed value stays with the cell's readers — never a page-wide error, never `undefined`.
test("a cell whose value never decodes: unrelated gets keep working, reading the cell throws until it decodes", () => {
  let loaded = false;
  const fn = (id: unknown, captures: unknown[]) => {
    if (id === "G" && !loaded) throw new Error("not loaded: G");
    return Object.assign(() => captures, { id });
  };
  // A = handler captures [cell → G], B = an unrelated handler.
  const decoder = createDecoder([{ f: "A", a: [1] }, { k: "cell", a: [2] }, { f: "G", a: [] }, { f: "B", a: [4] }, 9], { fn });
  const a = decoder.get(0) as () => unknown[];
  const b = decoder.get(3) as () => unknown[];
  assert.deepEqual(b(), [9]);
  const cell = a()[0] as { v: { id: string } };
  assert.equal(decoder.get(1), cell);
  assert.throws(() => cell.v, /not loaded: G/);
  assert.throws(() => cell.v, /not loaded: G/);
  assert.deepEqual((decoder.get(3) as () => unknown[])(), [9], "still working");
  loaded = true;
  assert.equal(cell.v.id, "G");
  assert.equal(cell.v, cell.v, "decoded once");
  // A write replaces a still failing accessor.
  loaded = false;
  const other = createDecoder(
    [
      { k: "cell", a: [1] },
      { f: "G", a: [] },
    ],
    { fn },
  ).get(0) as { v: unknown };
  assert.throws(() => other.v, /not loaded: G/);
  other.v = 3;
  assert.equal(other.v, 3);
  assert.deepEqual(Object.keys(other), ["v"]);
});
test("a container whose child fails once is rebuilt whole on the retry (not memoized half-built)", () => {
  const fail = new Set(["G", "H"]);
  const decoder = createDecoder(
    [{ o: ["f", 1, "n", 2] }, { f: "G", a: [] }, 4, { e: [1] }, { k: "cell", a: [5] }, { o: ["h", 6] }, { f: "H", a: [] }, { f: "C", a: [4] }],
    { fn: fnHook(fail) },
  );
  // The Set first, while its child fails, then the object.
  assert.throws(() => decoder.get(3), /not loaded: G/);
  fail.add("G");
  assert.throws(() => decoder.get(0), /not loaded: G/);
  const object = decoder.get(0) as { f: { id: string }; n: number };
  assert.deepEqual([object.f.id, object.n], ["G", 4]);
  assert.equal((decoder.get(3) as Set<unknown>).has(object.f), true);
  assert.equal((decoder.get(3) as Set<unknown>).size, 1);
  // Through a cell: its object value fails once inside a function → the cell's read rebuilds the whole object.
  const cell = (decoder.get(7) as () => unknown[])()[0] as { v: { h: { id: string } } };
  assert.equal(cell.v.h.id, "H");
});
// Fix round 4: a failed decode rolls back its whole frame — no entry decoded inside it keeps the discarded half-built object.
test("a cycle through a container whose sibling fails once: the retry rebuilds the function capturing it", () => {
  // `const actions = { self: () => actions, g }`: S captures the object, G fails once.
  const decoder = createDecoder([{ o: ["self", 1, "g", 2] }, { f: "S", a: [0] }, { f: "G", a: [] }], { fn: fnHook(new Set(["G"])) });
  assert.throws(() => decoder.get(0), /not loaded: G/);
  assert.equal(decoder.decoded(1), false, "S rolled back");
  const object = decoder.get(0) as { self: () => unknown[]; g: { id: string } };
  assert.equal(object.self()[0], object);
  assert.equal(object.g.id, "G");
  assert.equal(decoder.get(1), object.self);
});
test("a cell filled in the drain, then a failing sibling: the retry makes a new cell holding the rebuilt object", () => {
  // H captures a cell whose value is the enclosing object (filled when H is done, object still partial); G fails once.
  const decoder = createDecoder([{ o: ["h", 1, "g", 3] }, { f: "H", a: [2] }, { k: "cell", a: [0] }, { f: "G", a: [] }], { fn: fnHook(new Set(["G"])) });
  assert.throws(() => decoder.get(0), /not loaded: G/);
  assert.equal(decoder.decoded(2), false, "cell rolled back");
  const object = decoder.get(0) as { h: () => unknown[]; g: { id: string } };
  const cell = object.h()[0] as { v: unknown };
  assert.equal(cell.v, object);
  assert.equal(object.g.id, "G");
  assert.equal(decoder.get(2), cell);
});
test("a signal holding a function capturing it, then a failing sibling: one live signal on the retry", () => {
  // dom-resume queues each created signal (`pendingSignals`) and arms only the one the decoder still holds.
  const pending: [ref: number, signal: { value?: unknown; set(value: unknown): void }][] = [];
  const decoder = createDecoder([{ o: ["s", 1, "g", 3] }, { s: 2 }, { f: "F", a: [1] }, { f: "G", a: [] }], {
    fn: fnHook(new Set(["G"])),
    signal: (ref) => {
      const s = { value: undefined as unknown, set: (value: unknown) => void (s.value = value) };
      pending.push([ref, s]);
      return s as never;
    },
  });
  assert.throws(() => decoder.get(0), /not loaded: G/);
  assert.equal(decoder.decoded(1), false, "signal rolled back");
  const object = decoder.get(0) as { s: { value: () => unknown[] }; g: { id: string } };
  assert.equal(object.s.value()[0], object.s, "the function captures the live signal");
  assert.equal(pending.length, 2);
  const armed = pending.filter(([ref, s]) => decoder.decoded(ref) && decoder.get(ref) === s);
  assert.deepEqual(
    armed.map(([, s]) => s),
    [object.s],
  );
});
// Fix round 5 (T7 review 5, L18 / L15 / L17).
test("an inner failure caught by a cell inside the frame, then a failing sibling: both rolled back", () => {
  const decoder = createDecoder([{ o: ["s", 1, "c", 2, "g", 4] }, { f: "S", a: [0] }, { k: "cell", a: [3] }, { f: "X", a: [] }, { f: "G", a: [] }], {
    fn: fnHook(new Set(["X", "G"])),
  });
  assert.throws(() => decoder.get(0), /not loaded: G/);
  assert.deepEqual([decoder.decoded(1), decoder.decoded(2)], [false, false]);
  const object = decoder.get(0) as { s: () => unknown[]; c: { v: { id: string } } };
  assert.equal(object.s()[0], object);
  assert.equal(object.c.v.id, "X");
});
test("a queued cell rolled back while the queue drains is never filled", () => {
  const runs: string[] = [];
  const fail = new Set(["G"]);
  const fn = (id: unknown, captures: unknown[]) => (runs.push(id as string), fnHook(fail)(id, captures));
  const decoder = createDecoder(
    [{ f: "F", a: [1] }, { k: "cell", a: [2] }, { o: ["b", 3, "g", 5] }, { f: "B", a: [4] }, { k: "cell", a: [6] }, { f: "G", a: [] }, { f: "W", a: [] }],
    { fn },
  );
  const cell = (decoder.get(0) as () => unknown[])()[0] as { v: { b: () => unknown[]; g: { id: string } } };
  assert.deepEqual(runs, ["F", "B", "G"], "the orphan cell's value W is not decoded");
  assert.equal(decoder.decoded(6), false);
  assert.equal(cell.v.g.id, "G");
  assert.equal((cell.v.b()[0] as { v: { id: string } }).v.id, "W");
});
test("a failed cell's accessor decoding a signal calls `settle` once, after the signal is memoized", () => {
  const settled: boolean[] = [];
  const signals: unknown[] = [];
  const decoder = createDecoder([{ k: "cell", a: [1] }, { o: ["count", 2, "g", 3] }, { s: 4 }, { f: "G", a: [] }, 5], {
    fn: fnHook(new Set(["G"])),
    signal: () => {
      const s = { set: () => {} };
      signals.push(s);
      return s as never;
    },
    settle: () => void settled.push(decoder.decoded(2) && decoder.get(2) === signals.at(-1)),
  });
  const cell = decoder.get(0) as { v: { count: unknown } };
  assert.deepEqual(settled, []);
  assert.equal(cell.v.count, signals.at(-1));
  assert.deepEqual(settled, [true]);
  assert.equal(cell.v.count, signals.at(-1));
  assert.deepEqual(settled, [true], "a data property again: no further settle");
});
test("two pending cells and a cell queued while the queue drains all get their values", () => {
  const decoder = createDecoder([{ f: "F", a: [1, 2] }, { k: "cell", a: [3] }, { k: "cell", a: [4] }, 7, { f: "H", a: [5] }, { k: "cell", a: [6] }, 8], {
    fn: fnHook(new Set()),
  });
  const [a, b] = (decoder.get(0) as () => unknown[])() as [{ v: number }, { v: { id: string } }];
  assert.equal(a.v, 7);
  assert.equal(b.v.id, "H");
  assert.equal((b.v as unknown as () => unknown[])()[0], decoder.get(5));
  assert.equal((decoder.get(5) as { v: number }).v, 8);
});
