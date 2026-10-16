// Function Bridge T9: `.bind` partial application and mutually recursive group members.
import { test } from "vitest";
import assert from "node:assert/strict";
import { _rBound, _rFn, _rGroup } from "@rivetjs/runtime/server-resume";
import { createDecoder } from "@rivetjs/runtime/resume-format";
import type { EntryRecord } from "@rivetjs/runtime/resume-format";
import { roundTrip } from "./resume/bridge-encode.ts";

const bind = {
  custom: (kind: string, args: unknown[]) => (kind === "bind" ? (args[0] as (...a: unknown[]) => unknown).bind(args[1], ...args.slice(2)) : undefined),
};

test("a bound resumable function revives as fn.bind(self, ...args)", async () => {
  const { values } = await roundTrip(
    () => {
      const add = _rFn("m.tsx#P$add", (by: number) => by * 10, []);
      return [_rBound(add, null, [2])];
    },
    { "m.tsx#P$add": () => (by: number) => by * 10 },
    bind,
  );
  assert.equal((values[0] as () => number)(), 20);
});

test("bound-of-bound keeps both argument lists", async () => {
  const join = (a: number, b: number, c: number) => a * 100 + b * 10 + c;
  const { values, state } = await roundTrip(
    () => {
      const f = _rFn("m.tsx#P$join", join, []);
      return [_rBound(_rBound(f, null, [1]), null, [2])];
    },
    { "m.tsx#P$join": () => join },
    bind,
  );
  assert.equal(
    state.t.filter((e) => (e as EntryRecord | null)?.k === "bind" || (Array.isArray((e as EntryRecord | null)?.k) && (e as EntryRecord).k![0] === "bind"))
      .length,
    2,
  );
  assert.equal((values[0] as (c: number) => number)(3), 123);
});

test("a function with its own `bind` is left to it (no bind entry recorded)", async () => {
  const own = Object.assign((x: number) => x, { bind: () => "custom" });
  assert.equal(_rBound(own as never, null, []), "custom");
});

const evenOdd = () => {
  const even = (k: number): boolean => (k === 0 ? true : odd(k - 1));
  const odd = (k: number): boolean => (k === 0 ? false : even(k - 1));
  return [even, odd];
};

test("group members run the group factory once and keep identity", async () => {
  let runs = 0;
  const factory = () => (runs++, evenOdd());
  const { values, state } = await roundTrip(
    () => {
      const [even, odd] = _rGroup("m.tsx#P$g", evenOdd(), []);
      return [even, odd, { even }];
    },
    { "m.tsx#P$g": factory },
  );
  // One plain recipe for the group, members as `{i: [group, k]}`.
  assert.ok(state.t.some((e) => Array.isArray((e as EntryRecord | null)?.i) && (e as EntryRecord).i![1] === 1));
  const [even, odd, holder] = values as [(k: number) => boolean, (k: number) => boolean, { even: unknown }];
  assert.equal(even(10), true);
  assert.equal(odd(3), true);
  assert.equal(holder.even, even);
  assert.equal(runs, 1);
});

test("two instances with equal captures keep distinct members (one group entry each)", async () => {
  let runs = 0;
  const { values } = await roundTrip(
    () => {
      const a = _rGroup("m.tsx#P$g", evenOdd(), () => [5]);
      const b = _rGroup("m.tsx#P$g", evenOdd(), () => [5]);
      return [a[0], a[1], b[0], b[1]];
    },
    { "m.tsx#P$g": () => (runs++, evenOdd()) },
  );
  assert.notEqual(values[0], values[2]);
  assert.notEqual(values[1], values[3]);
  assert.equal(runs, 2);
});

test("a three-member group whose middle member is never referenced", async () => {
  const three = () => [() => "a", () => "b", () => "c"];
  const { values } = await roundTrip(
    () => {
      const [a, , c] = _rGroup("m.tsx#P$three", three(), []);
      return [a, c];
    },
    { "m.tsx#P$three": three },
  );
  assert.deepEqual(
    (values as (() => string)[]).map((f) => f()),
    ["a", "c"],
  );
});

test("a bound group member", async () => {
  const { values } = await roundTrip(
    () => {
      const [even] = _rGroup("m.tsx#P$g", evenOdd(), []);
      return [_rBound(even!, null, [4])];
    },
    { "m.tsx#P$g": evenOdd },
    bind,
  );
  assert.equal((values[0] as () => boolean)(), true);
});

test("a rolled-back frame drops the group it built: a retry calls the symbol again with the retried captures", () => {
  let fail = true;
  const calls: unknown[] = [];
  // 0: [member 0, failing entry]; 1: member 0; 2: the group (captures entry 3); 3: the captured object; 4: fails once;
  // 5: member 1 of the same group entry.
  const table = [[1, 4], { i: [2, 0] }, { f: "g", a: [3] }, { k: "box", a: [] }, { k: "flaky", a: [] }, { i: [2, 1] }];
  const decoder = createDecoder(table, {
    custom: (kind) => {
      if (kind === "box") return {};
      if (fail) throw new Error("flaky");
      return "ok";
    },
    fn: (_id, captures) => (calls.push(captures[0]), [() => "even", () => "odd"]),
  });
  assert.throws(() => decoder.get(0), /flaky/);
  assert.equal(calls.length, 1);
  fail = false;
  assert.equal((decoder.get(5) as () => string)(), "odd");
  assert.equal(calls.length, 2);
  assert.equal(calls[1], decoder.get(3));
  assert.notEqual(calls[0], calls[1]);
  assert.equal((decoder.get(1) as () => string)(), "even");
  assert.equal(calls.length, 2);
});

test("a group symbol whose result has no such member is a malformed entry", () => {
  const decoder = createDecoder([{ i: [1, 2] }, { f: "g", a: [] }], { fn: () => [() => 1] });
  assert.throws(() => decoder.get(0), /Invalid resume table entry/);
});

test("an effect capturing a group member (or a bound one) needs the group symbol's chunk", async () => {
  const { resumableToString, _rEffect } = await import("@rivetjs/runtime/server-resume");
  const manifest = { runtime: "/rt.js", symbols: { "t.tsx#T$fx": "/fx.js", "m.tsx#P$g": "/g.js" } };
  for (const wrap of [(f: () => void) => f, (f: () => void) => _rBound(f, null, [])]) {
    const html = (await resumableToString(
      () => {
        const [even] = _rGroup("m.tsx#P$g", evenOdd(), []);
        _rEffect("t.tsx#T$fx", [wrap(even as unknown as () => void)]);
        return "x" as never;
      },
      { manifest },
    )) as string;
    const state = JSON.parse(/<script type="rivet\/state"[^>]*>(.*?)<\/script>/s.exec(html)![1]!) as {
      c: string[];
      fx: [unknown, number[], unknown, number[]][];
    };
    assert.deepEqual(state.fx[0]![3].map((i) => state.c[i]).sort(), ["/fx.js", "/g.js"]);
  }
});
