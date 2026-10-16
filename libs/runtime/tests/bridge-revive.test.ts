// Function Bridge T25: resource holders rebuilt from their own data (`[serialize]()` + `static [revive](data)`, wire
// `{cls, a: [data], rv: 1}`); package classes through `registerClass(cls, { id, serialize, revive })` (a string `cls`: the
// registered id, no class symbol); `[serialize]` without a reviver is RV2102 at encode.
import { test } from "vitest";
import assert from "node:assert/strict";
import { _rClass, _rFn } from "@rivetjs/runtime/server-resume";
import { createDecoder, reachableSymbols, registerClass, revive, serialize } from "@rivetjs/runtime/resume-format";
import { roundTrip } from "./resume/bridge-encode.ts";
// The `cls` / `rv` decoders ship in the on-demand built-ins chunk.
import "@rivetjs/runtime/resume-builtins";

let revived = 0;
class Conn {
  live = false;
  url: string;
  constructor(url: string) {
    this.url = url;
  }
  [serialize]() {
    return { url: this.url };
  }
  static [revive](data: { url: string }) {
    revived++;
    const conn = new Conn(data.url);
    conn.live = true;
    return conn;
  }
}
// A package class: private state, no class symbol (never `_rClass`-registered), revived through its registered hooks.
class Opaque {
  #hex: string;
  constructor(hex: string) {
    this.#hex = hex;
  }
  hex() {
    return this.#hex;
  }
}
// A data class (T23) inside a resource holder's data.
class Cfg {
  url: string;
  retries: number;
  constructor(url: string, retries: number) {
    this.url = url;
    this.retries = retries;
  }
}
class Client {
  cfg: Cfg;
  constructor(cfg: Cfg) {
    this.cfg = cfg;
  }
  [serialize]() {
    return { cfg: this.cfg };
  }
  static [revive](data: { cfg: Cfg }) {
    // The reviver reads its data: every instance in it is complete (two-phase fills ran first).
    assert.ok(data.cfg instanceof Cfg && data.cfg.url === "wss://c" && data.cfg.retries === 3);
    return new Client(data.cfg);
  }
}
_rClass(Conn, "m.tsx#Conn$class");
_rClass(Cfg, "m.tsx#Cfg$class");
_rClass(Client, "m.tsx#Client$class");
registerClass(Opaque, { id: "pkg.Opaque", serialize: (o) => o.hex(), revive: (hex) => new Opaque(hex as string) });
const classes: Record<string, () => unknown> = {
  "m.tsx#Conn$class": () => Conn,
  "m.tsx#Cfg$class": () => Cfg,
  "m.tsx#Client$class": () => Client,
};

test("[serialize] / static [revive] rebuild the instance from its data ([serialize] beats the data proof)", async () => {
  const { values, html, state } = await roundTrip(() => [new Conn("wss://x")], { ...classes });
  // Only the serialized data travels: no `live` field.
  assert.doesNotMatch(html, /"live"/);
  assert.ok(state.t.some((e) => e !== null && typeof e === "object" && (e as { rv?: 1 }).rv === 1));
  const conn = values[0] as Conn;
  assert.ok(conn instanceof Conn);
  assert.equal(conn.url, "wss://x");
  assert.equal(conn.live, true);
});

test("revival is lazy: the reviver runs on first decode, once", async () => {
  const { state } = await roundTrip(() => [new Conn("wss://y"), "x"], { ...classes });
  const fx = state.fx[0]![1] as number[];
  const decoder = createDecoder(state.t, { fn: (id) => (classes[id as string] as () => unknown)() });
  const before = revived;
  assert.equal(decoder.get(fx[1]!), "x");
  assert.equal(revived, before);
  const conn = decoder.get(fx[0]!);
  assert.equal(decoder.get(fx[0]!), conn);
  assert.equal(revived, before + 1);
});

test("registerClass serializes a package class without reachable privates and without a class symbol", async () => {
  const { values, state } = await roundTrip(() => [new Opaque("65f0")]);
  const entry = state.t.find((e) => e !== null && typeof e === "object" && "cls" in e) as { cls: unknown; rv?: 1 };
  assert.deepEqual([entry.cls, entry.rv], ["pkg.Opaque", 1]);
  // The registered id is no page symbol and no need.
  assert.ok(!("pkg.Opaque" in (state.s as unknown as Record<string, number>)));
  assert.deepEqual([...reachableSymbols(state.t, state.fx[0]![1] as number[])], []);
  assert.ok(values[0] instanceof Opaque);
  assert.equal((values[0] as Opaque).hex(), "65f0");
});

test("a resource holder captured by a function: instances in its data are complete before the reviver runs", async () => {
  const { values } = await roundTrip(
    () => {
      const client = new Client(new Cfg("wss://c", 3));
      return [_rFn("m.tsx#Use$f", () => client, [client])];
    },
    { ...classes, "m.tsx#Use$f": (client: never) => () => client },
  );
  const client = (values[0] as () => Client)();
  assert.ok(client instanceof Client && client.cfg.retries === 3);
});

test("a resource holder whose data reaches itself is a decode error (its reviver needs the data first)", async () => {
  class Loop {
    self = this;
    [serialize]() {
      return { self: this.self };
    }
    static [revive]() {
      return new Loop();
    }
  }
  _rClass(Loop, "m.tsx#Loop$class");
  await assert.rejects(
    roundTrip(() => [new Loop()], { "m.tsx#Loop$class": () => Loop }),
    // Review T25 L2: the message names the holder.
    /^TypeError: Cyclic reference through revive of Loop: its \[serialize\] data leads back to a value still decoding/,
  );
});

// Review T25 L3 (pinned, documented in resuming.md): a holder's data decodes completely before its reviver, so a cycle
// back to the holder through it depends on which value the page reads first. Holder first: its data reaches the box, whose
// field is the holder (still BUSY) → error. Function first: the box (captured by the function) is memoized and its fill
// deferred until the function is done; then the fill decodes the holder, whose data finds the memoized box.
test("review T25 L3: a cycle back to a holder through its data decodes in one read order only", async () => {
  class Box {
    hub: unknown;
    constructor(hub: unknown) {
      this.hub = hub;
    }
  }
  class Hub {
    box: Box | undefined;
    [serialize]() {
      return { box: this.box };
    }
    static [revive](data: { box: Box }) {
      const hub = new Hub();
      hub.box = data.box;
      return hub;
    }
  }
  _rClass(Box, "m.tsx#Box$class");
  _rClass(Hub, "m.tsx#Hub$class");
  const symbols: Record<string, (...c: never[]) => unknown> = {
    "m.tsx#Box$class": () => Box,
    "m.tsx#Hub$class": () => Hub,
    "m.tsx#Use$b": (box: never) => () => box,
  };
  const make = (holderFirst: boolean) => () => {
    const hub = new Hub();
    const box = new Box(hub);
    hub.box = box;
    const use = _rFn("m.tsx#Use$b", () => box, [box]);
    return holderFirst ? [hub, use] : [use, hub];
  };
  await assert.rejects(roundTrip(make(true), symbols), /^TypeError: Cyclic reference through revive of Hub: /);
  const { values } = await roundTrip(make(false), symbols);
  const [use, hub] = values as [() => Box, Hub];
  assert.ok(hub instanceof Hub && hub.box === use() && use().hub === hub);
});

test("a built-in base is fine with a reviver: it constructs", async () => {
  class Bus extends EventTarget {
    topic: string;
    constructor(topic: string) {
      super();
      this.topic = topic;
    }
    [serialize]() {
      return this.topic;
    }
    static [revive](topic: string) {
      return new Bus(topic);
    }
  }
  _rClass(Bus, "m.tsx#Bus$class");
  const { values } = await roundTrip(() => [new Bus("t")], { "m.tsx#Bus$class": () => Bus });
  assert.ok(values[0] instanceof Bus && values[0] instanceof EventTarget && (values[0] as Bus).topic === "t");
});

test("[serialize] without a static [revive] is RV2102 at encode (dev and production)", async () => {
  class Half {
    n = 1;
    [serialize]() {
      return this.n;
    }
  }
  _rClass(Half, "m.tsx#Half$class");
  await assert.rejects(
    roundTrip(() => [new Half()]),
    /RV2102: Half has \[serialize\] but no static \[revive\]/,
  );
  class Pkg {}
  registerClass(Pkg, { id: "pkg.Pkg", revive: () => new Pkg() });
  await assert.rejects(
    roundTrip(() => [new Pkg()]),
    /registerClass `pkg\.Pkg` has no serialize hook/,
  );
  registerClass(Pkg, { id: "pkg.Pkg", serialize: () => 0, revive: undefined as never });
  await assert.rejects(
    roundTrip(() => [new Pkg()]),
    /RV2102: Pkg has \[serialize\] but no static \[revive\]/,
  );
});

test("registerClass ids: another class under a taken id throws; the same class again replaces its hooks; `#` / empty ids are rejected (dev + prod, review T25 L1)", async () => {
  class A {}
  class B {}
  registerClass(A, { id: "pkg.A", serialize: () => 1, revive: () => new A() });
  assert.throws(() => registerClass(B, { id: "pkg.A", serialize: () => 1, revive: () => new B() }), /id `pkg\.A` is already registered for another class/);
  let second = 0;
  registerClass(A, { id: "pkg.A", serialize: () => 2, revive: () => (second++, new A()) });
  const { values } = await roundTrip(() => [new A()]);
  assert.ok(values[0] instanceof A);
  assert.equal(second, 1);
  assert.throws(() => registerClass(B, { id: "m.tsx#B", revive: () => new B() }), /without `#`/);
  assert.throws(() => registerClass(B, { id: "", revive: () => new B() }), /non-empty string/);
});

test("a registered id the browser does not know is a clear decode error", async () => {
  class Lost {}
  registerClass(Lost, { id: "pkg.Lost", serialize: () => 0, revive: () => new Lost() });
  const { state } = await roundTrip(() => [new Lost()]);
  const table = state.t.map((e) => (e !== null && typeof e === "object" && (e as { cls?: unknown }).cls === "pkg.Lost" ? { ...e, cls: "pkg.Gone" } : e));
  assert.throws(() => createDecoder(table).get((state.fx[0]![1] as number[])[0]!), /Resume class `pkg\.Gone` is not registered here/);
});
