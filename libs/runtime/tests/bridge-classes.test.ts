// Function Bridge T23: registered data classes resume by prototype restore — `{cls, a: [fields]}`, decoded two-phase
// (`Object.create(Cls.prototype)` first, then the own fields); the constructor never runs in the browser. True private
// fields (`#x`) are not restorable (`Object.create` gives no private brand: D-priv), so no private accessor pair.
import { test } from "vitest";
import assert from "node:assert/strict";
import { _rClass, _rEffect, _rFn, resumableToString } from "@rivetjs/runtime/server-resume";
import { createDecoder, reachableSymbols } from "@rivetjs/runtime/resume-format";
import { roundTrip } from "./resume/bridge-encode.ts";
// The `cls` decoder ships in the on-demand built-ins chunk (T23 fix 1): resumed pages load it through the entries' needs.
import "@rivetjs/runtime/resume-builtins";

let constructed = 0;
class User {
  name: string;
  constructor(name: string) {
    constructed++;
    this.name = name;
  }
  initial() {
    return this.name[0]!.toUpperCase();
  }
}
// Public fields + a prototype accessor and a subclass: the chain is the prototype's, inherited methods keep working.
class Point {
  x: number;
  y: number;
  constructor(x: number, y: number) {
    constructed++;
    this.x = x;
    this.y = y;
  }
  get length() {
    return Math.hypot(this.x, this.y);
  }
}
class Point3 extends Point {
  z = 0;
}
// A field shadowing a prototype setter: restored as an own data property (class fields define, never assign).
class Guarded {
  hits = 0;
}
Object.defineProperty(Guarded.prototype, "hits", {
  set() {
    throw new Error("prototype setter ran");
  },
});
class Counter {
  c = 1;
  inc = _rFn("m.tsx#Counter$inc", () => ++this.c, [this]);
}
_rClass(User, "m.tsx#User$class");
_rClass(Point, "m.tsx#Point$class");
_rClass(Counter, "m.tsx#Counter$class");
_rClass(Guarded, "m.tsx#Guarded$class");
const classes: Record<string, () => unknown> = {
  "m.tsx#User$class": () => User,
  "m.tsx#Point$class": () => Point,
  "m.tsx#Counter$class": () => Counter,
  "m.tsx#Guarded$class": () => Guarded,
};

test("instances keep their prototype and fields; the constructor does not run", async () => {
  const shared = new User("cy");
  const make = () => [[new User("ada"), new User("bo")], { a: shared, b: shared }, new Point(3, 4)];
  const { values, state } = await roundTrip(make, { ...classes });
  assert.ok(state.t.some((e) => e !== null && typeof e === "object" && "cls" in e));
  // The class symbol is a page symbol (its chunk is a need of whatever reaches the instance).
  assert.ok("m.tsx#User$class" in (state.s as unknown as Record<string, number>) && "m.tsx#Point$class" in (state.s as unknown as Record<string, number>));
  assert.deepEqual([...reachableSymbols(state.t, state.fx[0]![1] as number[])].sort(), ["m.tsx#Point$class", "m.tsx#User$class"]);
  constructed = 0;
  const [[a, b], pair, point] = values as [[User, User], { a: User; b: User }, Point];
  assert.ok(a instanceof User && Object.getPrototypeOf(a) === User.prototype);
  assert.equal(a.initial() + b.initial(), "AB");
  assert.equal(pair.a, pair.b, "one instance reachable twice decodes once");
  assert.equal(pair.a.initial(), "C");
  assert.equal(point.length, 5);
  assert.deepEqual(Object.keys(point), ["x", "y"]);
  assert.equal(constructed, 0);
});

test("a registered subclass restores its own prototype; an unregistered one is refused; a field over a setter is defined", async () => {
  class Point4 extends Point {
    w = 1;
  }
  _rClass(Point4, "m.tsx#Point4$class");
  const { values } = await roundTrip(() => [new Point4(6, 8), new Guarded()], { ...classes, "m.tsx#Point4$class": () => Point4 });
  const [p, g] = values as [Point4, Guarded];
  assert.equal(Object.getPrototypeOf(p), Point4.prototype);
  assert.equal(p.length, 10);
  assert.equal(p.w, 1);
  assert.equal(Object.getOwnPropertyDescriptor(g, "hits")?.value, 0);
  // Review T23 M2: `Point3` is not registered (only its base): refused, never decoded as a `Point`.
  await assert.rejects(
    roundTrip(() => [new Point3(6, 8)], { ...classes }),
    /Point3 instance is not serializable: its class is not registered for resume \(its base Point is\)/,
  );
});

test("a class-field arrow capturing `this` decodes through the two-phase entry (either side first)", async () => {
  const symbols = { ...classes, "m.tsx#Counter$inc": (self: never) => () => ++(self as Counter).c };
  const { values } = await roundTrip(() => [new Counter()], symbols);
  const counter = values[0] as Counter;
  assert.equal(counter.inc(), 2);
  assert.equal(counter.c, 2);
  // The function first: its capture (the instance) decodes inside a BUSY entry — its fields fill once that entry is done.
  const { state } = await roundTrip(() => {
    const made = new Counter();
    return [made.inc, made];
  }, symbols);
  const fx = state.fx[0]![1] as number[];
  const decoder = createDecoder(state.t, {
    fn: (id, captures) => (symbols as unknown as Record<string, (...c: unknown[]) => unknown>)[id as string]!(...captures),
  });
  const inc = decoder.get(fx[0]!) as () => number;
  const instance = decoder.get(fx[1]!) as Counter;
  assert.equal(instance.inc, inc);
  assert.equal(inc(), 2);
  assert.equal(instance.c, 2);
});

test("fields failing inside a BUSY entry roll the frame back; a retry fails the same way, other reads keep working", async () => {
  class Flaky {
    n = 1;
    bad = _rFn("m.tsx#Flaky$bad", () => this.n, [this]);
    inc = _rFn("m.tsx#Flaky$inc", () => ++this.n, [this]);
  }
  _rClass(Flaky, "m.tsx#Flaky$class");
  const { state } = await roundTrip(
    () => {
      const made = new Flaky();
      return [made.inc, made, "ok"];
    },
    { "m.tsx#Flaky$class": () => Flaky, "m.tsx#Flaky$inc": (self: never) => () => ++(self as Flaky).n, "m.tsx#Flaky$bad": () => () => 0 },
  );
  const fx = state.fx[0]![1] as number[];
  const decoder = createDecoder(state.t, {
    fn: (id) => {
      if (id === "m.tsx#Flaky$bad") throw new Error("chunk failed");
      return id === "m.tsx#Flaky$class" ? Flaky : () => 0;
    },
  });
  assert.throws(() => decoder.get(fx[0]!), /chunk failed/);
  assert.throws(() => decoder.get(fx[0]!), /chunk failed/);
  assert.equal(decoder.decoded(fx[1]!), false);
  assert.equal(decoder.get(fx[2]!), "ok");
});

test("built-in bases (EventTarget, Map, Date, Error) and own `__proto__` fields are refused; unregistered classes are unchanged", async () => {
  class Bus extends EventTarget {}
  class Table extends Map<string, number> {}
  class Day extends Date {}
  class NotFound extends Error {
    code = 404;
  }
  class Odd {
    constructor() {
      Object.defineProperty(this, "__proto__", { value: 1, writable: true, enumerable: true, configurable: true });
    }
  }
  for (const [C, id] of [
    [Bus, "Bus"],
    [Table, "Table"],
    [Day, "Day"],
    [NotFound, "NotFound"],
    [Odd, "Odd"],
  ] as const)
    _rClass(C, "m.tsx#" + id + "$class");
  await assert.rejects(
    roundTrip(() => [new Bus()]),
    /Bus instance is not serializable: it extends the built-in EventTarget; use static \[revive\]/,
  );
  await assert.rejects(
    roundTrip(() => [new Table()]),
    /Table instance is not serializable: it extends the built-in Map/,
  );
  await assert.rejects(
    roundTrip(() => [new Day(0)]),
    /Day instance is not serializable: it extends the built-in Date/,
  );
  await assert.rejects(
    roundTrip(() => [new NotFound("x")]),
    /NotFound instance is not serializable: it extends the built-in Error/,
  );
  await assert.rejects(
    roundTrip(() => [new Odd()]),
    /Odd instance is not serializable: its own `__proto__` field does not resume/,
  );
  class Loose {
    v = 1;
  }
  await assert.rejects(
    roundTrip(() => [new Loose()]),
    /Loose instance is not serializable/,
  );
});

test("a user class exposed on globalThis (UMD / polyfill global) stays a data base (T23 re-review L1)", async () => {
  class Decimal {
    v: number;
    constructor(v: number) {
      this.v = v;
    }
  }
  class Price extends Decimal {
    twice() {
      return this.v * 2;
    }
  }
  const g = globalThis as Record<string, unknown>;
  g.Decimal = Decimal;
  try {
    _rClass(Price, "m.tsx#Price$class");
    const { values } = await roundTrip(() => [new Price(4)], { "m.tsx#Price$class": () => Price });
    const price = values[0] as Price;
    assert.ok(price instanceof Price);
    assert.equal(price.twice(), 8);
  } finally {
    delete g.Decimal;
  }
});

test("dev: own state that does not resume as it is fails; production drops it (spec risk 5)", async () => {
  const DEV_RUN = process.execArgv.includes("--conditions=development");
  const tag = Symbol("tag");
  class Shapes {
    a = 1;
    constructor(kind: string) {
      if (kind === "symbol") (this as Record<symbol, unknown>)[tag] = 1;
      if (kind === "hidden") Object.defineProperty(this, "h", { value: 1, writable: true, enumerable: false, configurable: true });
      if (kind === "accessor") Object.defineProperty(this, "g", { get: () => 2, enumerable: true, configurable: true });
      if (kind === "readonly") Object.defineProperty(this, "r", { value: 3, writable: false, enumerable: true, configurable: true });
      if (kind === "frozen") Object.freeze(this);
    }
  }
  _rClass(Shapes, "m.tsx#Shapes$class");
  const symbols = { "m.tsx#Shapes$class": () => Shapes };
  const cases: [string, RegExp][] = [
    ["symbol", /a symbol key `Symbol\(tag\)` does not resume/],
    ["hidden", /a non-enumerable field `h` does not resume/],
    ["accessor", /an accessor `g` does not resume/],
    ["readonly", /a non-writable field `r` does not resume/],
    ["frozen", /it is frozen, sealed or non-extensible/],
  ];
  for (const [kind, error] of cases) {
    const run = roundTrip(() => [new Shapes(kind)], symbols);
    if (DEV_RUN) await assert.rejects(run, error, kind);
    else {
      const [out] = (await run).values as [Record<string | symbol, unknown>];
      assert.equal(out.a, 1, kind);
      assert.equal(out[tag], undefined, kind);
      assert.equal(out.h, undefined, kind);
    }
  }
});

test("the class decoder ships in the built-ins chunk: listed only for pages holding an instance", async () => {
  const manifest = { runtime: "/rt.js", builtins: "/builtins.js", symbols: { "t.tsx#T$fx": "/c.js", "m.tsx#User$class": "/u.js" } };
  const page = (value: () => unknown) =>
    resumableToString(
      () => {
        _rEffect("t.tsx#T$fx", [value()]);
        return "x" as never;
      },
      { manifest },
    ) as Promise<string>;
  const html = await page(() => new User("x"));
  assert.ok(html.includes("/builtins.js") && html.includes("/u.js"), html);
  assert.ok(!(await page(() => ({ name: "x" }))).includes("/builtins.js"));
  // Without that chunk the entry does not decode; without the `fn` hook neither (the class symbol's factory).
  const { state } = await roundTrip(() => [new User("x")], { ...classes });
  const ref = (state.fx[0]![1] as number[])[0]!;
  assert.throws(() => createDecoder(state.t).get(ref), /requires a fn hook/);
  const key = Symbol.for("rivet.builtins") as never,
    saved = (globalThis as Record<symbol, unknown>)[key];
  delete (globalThis as Record<symbol, unknown>)[key];
  try {
    assert.throws(() => createDecoder(state.t, { fn: () => User }).get(ref), /resume-builtins|Unknown resume table entry/);
  } finally {
    (globalThis as Record<symbol, unknown>)[key] = saved;
  }
});
