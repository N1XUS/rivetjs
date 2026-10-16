// `serializeAndRevive` fixtures (Function Bridge T30, tests/serialize-and-revive.test.ts): values built where a component
// body runs, so the compiler's resume sites (`_rFn`, `_rCell`, `_rClass`, `_rMod`, `_rStorePaths`, `reconstruct`) register.
import { createContext, provide, signal, useContext } from "@rivetjs/reactivity";
import { createStore, read, write } from "@rivetjs/reactivity/store";
import { clientEffect, reconstruct } from "@rivetjs/runtime/dom";
import { registerClass, revive, serialize } from "@rivetjs/runtime/resume-format";
import { Conn, plainClosure } from "./serialize-plain.ts";

/** A data class of this module (`_rClass`): prototype + own fields restored, the constructor does not run again. */
export class Money {
  cents: number;
  constructor(cents: number) {
    this.cents = cents;
    constructed.push(cents);
  }
  euros() {
    return this.cents / 100;
  }
}
export const constructed: number[] = [];

/** A class with its own reviver (`[serialize]` / `static [revive]`). */
export class Point {
  #x: number;
  constructor(x: number) {
    this.#x = x;
  }
  get x() {
    return this.#x;
  }
  [serialize]() {
    return this.#x;
  }
  static [revive](x: number) {
    return new Point(x);
  }
}

/** A "package" class registered with `registerClass` (state behind a private field). */
export class Token {
  #id: string;
  constructor(id: string) {
    this.#id = id;
  }
  get id() {
    return this.#id;
  }
}
registerClass(Token, { id: "fixture.Token", serialize: (t) => t.id, revive: (id) => new Token(id as string) });

/** A module-level function used by name: resumes by reference (`_rMod`). */
export function double(n: number) {
  return n * 2;
}

export function Counter() {
  const n = signal(1);
  let calls = 0;
  const inc = () => {
    calls++;
    n.set(n() + 1);
    return calls;
  };
  return { n, inc, double };
}

export function Classes() {
  return { money: new Money(250), point: new Point(3), token: new Token("t-1") };
}

export function Store() {
  const s = createStore({ user: { name: "Ada", bio: "long text never read" }, count: 1 });
  const rename = () => write(s, "user.name", (name: string) => name + "!");
  const name = () => read(s, "user.name");
  return { rename, name };
}

export function Rebuilt() {
  const base = signal(2);
  const box = reconstruct(() => ({ made: base() * 10, browser: typeof window !== "undefined" }));
  const readBox = () => box();
  return { readBox };
}

export function Cycle() {
  const a: { name: string; self?: unknown; list: unknown[] } = { name: "a", list: [] };
  a.self = a;
  a.list.push(a, a);
  return a;
}

/** A closure built by a plain `.ts` module (never resume-compiled): not serializable. */
export function NotCaptured() {
  return { fn: plainClosure() };
}

/** Refused values (the encoder's own messages, tests/serialize-and-revive.test.ts compares them with a page's). */
export function Socket() {
  return { conn: new WebSocketLike() };
}
class WebSocketLike extends EventTarget {}
export function Weak() {
  return { cache: new WeakMap() };
}
export function Pending() {
  return { answer: Promise.resolve(1) };
}
export function Evaluated() {
  return { fn: new Function("return 1") };
}
/** `[serialize]` without `static [revive]` (runtime RV2102: the class lives in a plain module the compiler never checks). */
export function Serializer() {
  return { conn: new Conn() };
}

/** A component that registers its own client effect while `make()` runs: its effect precedes the value's in the state. */
export function Effectful() {
  const seen = signal(0);
  clientEffect(() => {
    seen.set(1);
  });
  return { kind: "value", seen };
}

/** A provided value of an unregistered token: a `{x}` reference the browser supplies through `contexts`. */
export const Theme = createContext<{ name: string } | null>(null, { id: "fixture.theme" });
export function Themed() {
  return provide(Theme, { name: "server" }, () => ({ theme: useContext(Theme) }));
}

/** A reviver reading a browser global while the value decodes (`platform`). */
export class Probe {
  seen: string;
  constructor(seen: string) {
    this.seen = seen;
  }
  [serialize]() {
    return 0;
  }
  static [revive]() {
    return new Probe(typeof (globalThis as { window?: unknown }).window);
  }
}
export function Platform() {
  return { probe: new Probe("server") };
}

/** The docs example (apps/docs/content/guides/tooling/testing-resumability.md), verbatim. */
export function Cart() {
  const total = signal(new Money(250));
  let adds = 0;
  const add = (cents: number) => {
    adds++;
    total.set(new Money(total().cents + cents));
    return adds;
  };
  return { total, add };
}
