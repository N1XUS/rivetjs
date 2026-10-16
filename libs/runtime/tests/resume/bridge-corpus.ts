// Function Bridge failure corpus (BRIDGE-P0, spec docs/design/specs/2026-10-09-function-bridge-design.md):
// one resumed page per capture pattern. Each case renders `Page` on the server (resume recorder), loads it in
// Chromium, clicks `steps` and reads `read` (default: `.out` text) after each step.
//   expect — what a correct resumable framework shows (plain client semantics: as if the component ran in the browser).
//   today  — what the current build does: "pass" | "compile" (compiler diagnostic) | "render" (server render throws) |
//            "client" (page error / console error) | "wrong" (no error, wrong text) | "bytes" (state over-captures).
//   note   — a fragment of today's message (pinned; case-insensitive).
// Sources are strings (not fixtures) so a case can fail to compile without failing the suite's import.
export type Status = "pass" | "compile" | "render" | "client" | "wrong" | "bytes";
export interface BridgeCase {
  id: string;
  group: "container" | "this" | "closure" | "shape" | "narrow" | "class" | "builtin" | "library" | "context" | "skew";
  title: string;
  source: string;
  /** Bare specifier → ES module text of a non-resume library (served as-is, imported by server + browser). */
  libs?: Record<string, string>;
  /** DOM-side source when it differs from the server's (deploy skew: chunks built from another version). */
  domSource?: string;
  steps?: string[];
  read?: string;
  expect: string[];
  /** Strings the encoded state must not contain (narrow captures). */
  absent?: string[];
  today: Status;
  /** Today's status under `--conditions=development` (project runtime-dev) when it differs (dev encode-time checks). */
  todayDev?: Status;
  note?: string;
  /**
   * The correct outcome is a named error, not `expect` (spec §4: resource holders / library objects need `reconstruct`
   * or `static [revive]`). The bridge test asserts this status + message (regex, case-insensitive) instead of `expect`.
   */
  bridge?: { status: "compile" | "render" | "client"; message: string };
}

const counter = (body: string, out = "{n()}") => `
import { signal } from "@rivetjs/reactivity";
${body}
export function Page() {
  const n = signal(0);
  __SETUP__
  return (
    <section>
      <span class="out">${out}</span>
      <button class="go" onClick={() => __CALL__}>go</button>
    </section>
  );
}`;
/** A counter page: `setup` runs in the component body, `call` is the `.go` handler body. */
const page = (setup: string, call: string, prelude = "", out = "{n()}") => counter(prelude, out).replace("__SETUP__", setup).replace("__CALL__", call);

export const cases: BridgeCase[] = [
  // ── functions inside containers ────────────────────────────────────────────────────────────────────────────
  {
    id: "obj-inline-fn",
    group: "container",
    title: "inline arrow as an object literal value (control: R2 today)",
    source: page("const api = { inc: () => n.set(n() + 1) };", "api.inc()"),
    expect: ["0", "1"],
    today: "pass",
  },
  {
    id: "obj-module-fn",
    group: "container",
    title: "module-level function stored in an object",
    source: page("const api = { inc };", "api.inc(n)", "function inc(s: { (): number; set(v: number): void }) { s.set(s() + 1); }"),
    expect: ["0", "1"],
    today: "pass",
  },
  {
    id: "array-fn",
    group: "container",
    title: "arrow stored in an array",
    source: page("const fns = [() => n.set(n() + 1)];", "fns[0]!()"),
    expect: ["0", "1"],
    today: "pass",
  },
  {
    id: "map-fn",
    group: "container",
    title: "arrow stored as a Map value",
    source: page('const fns = new Map([["inc", () => n.set(n() + 1)]]);', 'fns.get("inc")!()'),
    expect: ["0", "1"],
    today: "pass",
  },
  {
    id: "assigned-fn",
    group: "container",
    title: "arrow assigned to an object property after creation",
    source: page("const api: { inc?: () => void } = {}; api.inc = () => n.set(n() + 1);", "api.inc!()"),
    expect: ["0", "1"],
    today: "pass",
  },
  {
    id: "holder-let-later",
    group: "container",
    title: "holder function over a `let` assigned after the holder site (boxed cell, T8)",
    source: page(
      "const api: { inc?: () => void } = {}; let step: (() => void) | undefined; api.inc = () => step!(); step = () => n.set(n() + 1);",
      "api.inc!()",
    ),
    expect: ["0", "1"],
    today: "pass",
  },
  {
    id: "signal-fn",
    group: "container",
    title: "signal holding a function (state machine step)",
    source: page("const step = signal<() => void>(() => n.set(n() + 1));", "step()()"),
    expect: ["0", "1"],
    today: "pass",
  },
  {
    id: "context-fn",
    group: "container",
    title: "function provided through a context, read in the component body",
    source: `
import { createContext, signal, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
const Api = createContext<{ inc: () => void }>({ inc: () => {} });
function Child(props: { n: () => number }) {
  const api = useContext(Api);
  return (
    <section>
      <span class="out">{props.n()}</span>
      <button class="go" onClick={() => api.inc()}>go</button>
    </section>
  );
}
export function Page() {
  const n = signal(0);
  return (
    <Provider token={Api} value={{ inc: () => n.set(n() + 1) }}>
      <Child n={n} />
    </Provider>
  );
}`,
    expect: ["0", "1"],
    today: "pass",
  },
  {
    id: "context-in-handler",
    group: "context",
    title: "useContext inside the handler itself (resumed handler runs under the resume root)",
    source: `
import { createContext, signal, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
const Name = createContext("default", { id: "bridge-name" });
function Child() {
  const out = signal("idle");
  return (
    <section>
      <span class="out">{out()}</span>
      <button class="go" onClick={() => out.set(useContext(Name))}>go</button>
    </section>
  );
}
export function Page() {
  return (
    <Provider token={Name} value="server">
      <Child />
    </Provider>
  );
}`,
    expect: ["idle", "server"],
    today: "wrong",
    note: '"default"',
  },
  {
    id: "context-in-binding",
    group: "context",
    title: "captured function reading a context, called by a binding (RESUME-CTX known limit)",
    source: `
import { createContext, signal, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import { resumableContext } from "@rivetjs/runtime/resume-format";
const Name = resumableContext(createContext("default", { id: "bridge-bind" }));
function Child() {
  const n = signal(0);
  const name = () => useContext(Name);
  return (
    <section>
      <span class="out">{name() + ":" + n()}</span>
      <button class="go" onClick={() => n.set(n() + 1)}>go</button>
    </section>
  );
}
export function Page() {
  return (
    <Provider token={Name} value="server">
      <Child />
    </Provider>
  );
}`,
    expect: ["server:0", "server:1"],
    today: "wrong",
    note: "default:1",
  },
  {
    id: "context-row",
    group: "context",
    title: "For row created after resume calls a function from a plain (unregistered) context",
    source: `
import { createContext, signal, useContext } from "@rivetjs/reactivity";
import { For, Provider } from "@rivetjs/runtime/dom";
const Fmt = createContext<(x: string) => string>((x) => x);
function Row(props: { x: string }) {
  const fmt = useContext(Fmt);
  return <i>{fmt(props.x)}</i>;
}
export function Page() {
  const xs = signal(["a"]);
  return (
    <Provider token={Fmt} value={(x: string) => "<" + x + ">"}>
      <section>
        <span class="out">
          <For each={xs()} by={(x: string) => x}>
            {(x) => <Row x={x()} />}
          </For>
        </span>
        <button class="go" onClick={() => xs.set([...xs(), "b"])}>go</button>
      </section>
    </Provider>
  );
}`,
    expect: ["<a>", "<a><b>"],
    today: "wrong",
    note: "<a>b",
  },
  // ── `this` / methods ─────────────────────────────────────────────────────────────────────────────────────────
  {
    id: "method-this",
    group: "this",
    title: "object store with a method using `this`",
    source: page("const store = { count: n, inc() { this.count.set(this.count() + 1); } };", "store.inc()"),
    expect: ["0", "1"],
    today: "pass",
  },
  {
    id: "method-arrow-in-this",
    group: "this",
    title: "method shorthand without `this` (control: R2 method shorthand)",
    source: page("const store = { inc() { n.set(n() + 1); } };", "store.inc()"),
    expect: ["0", "1"],
    today: "pass",
  },
  {
    id: "getter-object",
    group: "this",
    title: "object with a getter, read by a handler",
    source: page("const view = { get next() { return n() + 1; } };", "n.set(view.next)"),
    expect: ["0", "1"],
    today: "pass",
  },
  {
    id: "class-store",
    group: "class",
    title: "class store: signal field + method (`new Counter()` captured)",
    source: page(
      "const store = new Counter(n);",
      "store.inc()",
      "class Counter { count: { (): number; set(v: number): void }; constructor(c: { (): number; set(v: number): void }) { this.count = c; } inc() { this.count.set(this.count() + 1); } }",
    ),
    expect: ["0", "1"],
    today: "pass",
  },
  {
    id: "class-arrow-field",
    group: "class",
    title: "class with an arrow field (`inc = () => …`)",
    source: page(
      "const store = new Counter(n);",
      "store.inc()",
      "class Counter { constructor(public c: { (): number; set(v: number): void }) {} inc = () => this.c.set(this.c() + 1); }",
    ),
    expect: ["0", "1"],
    today: "pass",
  },
  // ── closures ────────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: "let-before",
    group: "closure",
    title: "`let` reassigned in the body before render ends",
    source: page("let step = 1; step = 5;", "n.set(n() + step)"),
    expect: ["0", "5"],
    today: "pass",
  },
  {
    id: "let-after-jsx",
    group: "closure",
    title: "`let` reassigned after the JSX that captures it was created",
    source: `
import { signal } from "@rivetjs/reactivity";
export function Page() {
  const out = signal("idle");
  let label = "early";
  const view = (
    <section>
      <span class="out">{out()}</span>
      <button class="go" onClick={() => out.set(label)}>go</button>
    </section>
  );
  label = "late";
  return view;
}`,
    expect: ["idle", "late"],
    today: "pass",
  },
  {
    id: "let-shared-cell",
    group: "closure",
    title: "`let` mutated by one handler, read by another (shared cell)",
    source: `
import { signal } from "@rivetjs/reactivity";
export function Page() {
  const out = signal("0");
  let clicks = 0;
  return (
    <section>
      <span class="out">{out()}</span>
      <button class="go" onClick={() => { clicks++; }}>go</button>
      <button class="show" onClick={() => out.set(String(clicks))}>show</button>
    </section>
  );
}`,
    steps: [".go", ".go", ".show"],
    expect: ["0", "0", "0", "2"],
    today: "pass",
  },
  {
    id: "let-hoisted-after-write",
    group: "closure",
    title: "capturing closure in a hoisted function declaration placed after the write (T8 fix H1)",
    source: `
import { signal } from "@rivetjs/reactivity";
export function Page() {
  const out = signal("idle");
  let x = 0;
  const view = make();
  x = 5;
  return view;
  function make() {
    return (
      <section>
        <span class="out">{out()}</span>
        <button class="go" onClick={() => out.set(String(x))}>go</button>
      </section>
    );
  }
}`,
    expect: ["idle", "5"],
    today: "pass",
  },
  {
    id: "let-class-field-write",
    group: "closure",
    title: "`let` written by a class field initializer that runs after the JSX (T8 fix H1)",
    source: `
import { signal } from "@rivetjs/reactivity";
export function Page() {
  const out = signal("idle");
  let x = 0;
  class K {
    v = (x = 2);
  }
  const view = (
    <section>
      <span class="out">{out()}</span>
      <button class="go" onClick={() => out.set(String(x))}>go</button>
    </section>
  );
  new K();
  return view;
}`,
    expect: ["idle", "2"],
    today: "pass",
  },
  {
    id: "let-handler-by-name",
    group: "closure",
    title: "handler passed by name, its `let` reassigned after the JSX: the bound listener stays (T8 fix M1)",
    source: `
import { signal } from "@rivetjs/reactivity";
export function Page() {
  const out = signal("idle");
  let h = () => out.set("a");
  const view = (
    <section>
      <span class="out">{out()}</span>
      <button class="go" onClick={h}>go</button>
      <button class="late" onClick={() => h()}>late</button>
    </section>
  );
  h = () => out.set("b");
  return view;
}`,
    steps: [".go", ".late"],
    expect: ["idle", "a", "b"],
    today: "pass",
  },
  {
    id: "let-eager-nested-arrow",
    group: "closure",
    title: "arrow inside an eager handler expression shares the boxed `let` with a sibling handler (T8 fix M2)",
    source: `
import { signal } from "@rivetjs/reactivity";
export function Page() {
  const out = signal("idle");
  const on = true as boolean;
  let x = 0;
  return (
    <section>
      <span class="out">{out()}</span>
      <button class="go" onClick={on ? () => { x++; out.set(String(x)); } : undefined}>go</button>
      <button class="show" onClick={() => out.set("seen " + x)}>show</button>
    </section>
  );
}`,
    steps: [".go", ".go", ".show"],
    expect: ["idle", "1", "2", "seen 2"],
    today: "pass",
  },
  {
    id: "let-multi-declarator",
    group: "closure",
    title: "one boxed declarator next to a plain one (`let a = …, b = …`)",
    source: `
import { signal } from "@rivetjs/reactivity";
export function Page() {
  const out = signal("0");
  let a = 1,
    b = 10;
  return (
    <section>
      <span class="out">{out()}</span>
      <button class="go" onClick={() => { a++; out.set(String(a + b)); }}>go</button>
    </section>
  );
}`,
    steps: [".go", ".go"],
    expect: ["0", "12", "13"],
    today: "pass",
  },
  {
    id: "let-non-ascii",
    group: "closure",
    title: "non-ASCII binding and strings around the rewritten references (server state ASCII: the harness page has no charset)",
    source: `
import { signal } from "@rivetjs/reactivity";
export function Page() {
  const out = signal("u");
  let größe = "a";
  return (
    <section>
      <span class="out">{out()}</span>
      <button class="go" title="→" onClick={() => { größe += "é"; out.set("ö" + größe); }}>go</button>
    </section>
  );
}`,
    expect: ["u", "öaé"],
    today: "pass",
  },
  {
    id: "let-destructure-server",
    group: "closure",
    title: "server-side shorthand destructuring write and shorthand read of a boxed `let`",
    source: `
import { signal } from "@rivetjs/reactivity";
export function Page() {
  const out = signal("idle");
  let n = 0;
  ({ n } = { n: 4 });
  const box = { n };
  return (
    <section>
      <span class="out">{out()}</span>
      <button class="go" onClick={() => { n++; out.set(n + "/" + box.n); }}>go</button>
    </section>
  );
}`,
    expect: ["idle", "5/4"],
    today: "pass",
  },
  {
    id: "let-for-row",
    group: "closure",
    title: "`For` rows sharing one boxed `let`",
    source: `
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
export function Page() {
  const out = signal("idle");
  let picks = 0;
  return (
    <section>
      <span class="out">{out()}</span>
      <ul>
        <For each={["a", "b"]} by={(x: string) => x}>{(x) => <li class={x()} onClick={() => { picks++; out.set(x() + picks); }}>{x()}</li>}</For>
      </ul>
    </section>
  );
}`,
    steps: [".a", ".b"],
    expect: ["idle", "a1", "b2"],
    today: "pass",
  },
  {
    // T7 L17 (fix 5): a signal first decoded through a templated row's item (dom-resume `konst` / row refs, not the
    // `get` wrapper) is armed before the handler's `set`, so the bindings reading it update on that click (before fix 5:
    // the arm took the new value as its baseline — "0,0,0,0" after every click).
    id: "signal-row-const-set",
    group: "closure",
    title: "`For` rows holding a shared signal: the handler reads it through its row, then sets it",
    source: `
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
export function Page() {
  const count = signal(0);
  const rows = signal([0, 1, 2, 3].map((k) => ({ id: "r" + k, count })));
  return (
    <ul>
      <For each={rows} by={(r: { id: string }) => r.id}>{(r) => <li class={r().id} onClick={() => r().count.set(r().count() + 1)}>{count()}</li>}</For>
    </ul>
  );
}`,
    steps: [".r0", ".r1"],
    read: `[...document.querySelectorAll("li")].map((li) => li.textContent).join(",")`,
    expect: ["0,0,0,0", "1,1,1,1", "2,2,2,2"],
    today: "pass",
  },
  {
    id: "let-loop-body",
    group: "closure",
    title: "a loop-body `let` gets one cell per iteration",
    source: `
import { signal } from "@rivetjs/reactivity";
export function Page() {
  const out = signal("idle");
  const rows = [];
  for (const x of [1, 2]) {
    let k = x * 10;
    rows.push(<button class={"r" + x} onClick={() => { k++; out.set(String(k)); }}>{x}</button>);
  }
  return (
    <section>
      <span class="out">{out()}</span>
      {rows}
    </section>
  );
}`,
    steps: [".r1", ".r2", ".r1"],
    expect: ["idle", "11", "21", "12"],
    today: "pass",
  },
  {
    id: "hoisted-declaration",
    group: "closure",
    title: "function declaration after `return` (hoisted), called by a handler",
    source: `
import { signal } from "@rivetjs/reactivity";
export function Page() {
  const n = signal(0);
  return (
    <section>
      <span class="out">{n()}</span>
      <button class="go" onClick={() => bump()}>go</button>
    </section>
  );
  function bump() {
    n.set(n() + 1);
  }
}`,
    expect: ["0", "1"],
    today: "pass",
  },
  {
    id: "recursive",
    group: "closure",
    title: "self-recursive local arrow",
    source: page("const fact = (k: number): number => (k <= 1 ? 1 : k * fact(k - 1));", "n.set(fact(4))"),
    expect: ["0", "24"],
    today: "pass",
  },
  {
    id: "mutual-recursion",
    group: "closure",
    title: "mutually recursive local functions",
    source: page(
      "function even(k: number): boolean { return k === 0 ? true : odd(k - 1); } function odd(k: number): boolean { return k === 0 ? false : even(k - 1); }",
      "n.set(even(10) ? 2 : 1)",
    ),
    expect: ["0", "2"],
    today: "pass",
  },
  {
    id: "mutual-recursion-const",
    group: "closure",
    title: "mutually recursive const arrows sharing a mutable let (one group symbol, one cell)",
    source: page(
      "let hits = 0; const even = (k: number): boolean => { hits++; return k === 0 ? true : odd(k - 1); }; const odd = (k: number): boolean => (k === 0 ? false : even(k - 1));",
      "n.set(even(n() + 2) ? hits : -1)",
    ),
    expect: ["0", "2"],
    today: "pass",
  },
  {
    id: "mutual-recursion-identity",
    group: "closure",
    title: "group members captured through two holders keep one identity",
    source: page(
      "function even(k: number): boolean { return k === 0 ? true : odd(k - 1); } function odd(k: number): boolean { return k === 0 ? false : even(k - 1); } const a = { even }, b = { odd };",
      "n.set(a.even === even && b.odd === odd && even(4) ? n() + 1 : -1)",
    ),
    expect: ["0", "1"],
    today: "pass",
  },
  {
    id: "identity-twice",
    group: "closure",
    title: "one function captured through two objects keeps its identity",
    source: page("const f = () => 1; const a = { f }, b = { f };", "n.set(a.f === b.f ? 1 : -1)"),
    expect: ["0", "1"],
    today: "pass",
  },
  {
    id: "factory-captures",
    group: "closure",
    title: "function returned from a module-level factory, closing over its argument",
    source: page(
      "const inc = makeInc(n, 3);",
      "inc()",
      "function makeInc(s: { (): number; set(v: number): void }, by: number) { return () => s.set(s() + by); }",
    ),
    expect: ["0", "3"],
    today: "pass",
  },
  {
    id: "factory-inline",
    group: "closure",
    title: "function returned from an inline IIFE factory",
    source: page("const inc = ((by: number) => () => n.set(n() + by))(2);", "inc()"),
    expect: ["0", "2"],
    today: "pass",
  },
  {
    id: "async-fn",
    group: "shape",
    title: "local async function called by a handler",
    source: page("const load = async () => { await null; n.set(n() + 1); };", "void load()"),
    expect: ["0", "1"],
    today: "pass",
  },
  {
    id: "generator",
    group: "shape",
    title: "local generator function",
    source: page("function* ids() { yield 1; yield 2; yield 3; }", "n.set([...ids()].length)"),
    expect: ["0", "3"],
    today: "pass",
  },
  {
    id: "bound-fn",
    group: "shape",
    title: "`.bind` partial application",
    source: page("const add = (by: number) => n.set(n() + by); const inc = add.bind(null, 2);", "inc()"),
    expect: ["0", "2"],
    today: "pass",
  },
  {
    id: "bound-of-bound",
    group: "shape",
    title: "`.bind` of a bound function",
    source: page("const add = (a: number, b: number) => n.set(n() + a * b); const by2 = add.bind(null, 2); const inc = by2.bind(null, 3);", "inc()"),
    expect: ["0", "6"],
    today: "pass",
  },
  {
    id: "bound-module-fn",
    group: "shape",
    title: "`.bind` of a module-level function",
    source: page("const plus3 = plus.bind(null, 3);", "n.set(plus3(n()))", "function plus(a: number, b: number) { return a + b; }"),
    expect: ["0", "3"],
    today: "pass",
  },
  {
    id: "bound-const-child-prop",
    group: "shape",
    title: "a bound const passed to a child component prop by name",
    source: `
import { signal } from "@rivetjs/reactivity";
function Child(props: { onPress: () => void }) {
  return <button class="go" onClick={() => props.onPress()}>go</button>;
}
export function Page() {
  const n = signal(0);
  const add = (by: number) => n.set(n() + by);
  const inc = add.bind(null, 2);
  return (
    <section>
      <span class="out">{n()}</span>
      <Child onPress={inc} />
    </section>
  );
}`,
    expect: ["0", "2"],
    today: "pass",
  },
  {
    id: "bound-inline-child-prop",
    group: "shape",
    title: "an inline `.bind` as a child component prop",
    source: `
import { signal } from "@rivetjs/reactivity";
function Child(props: { onPress: () => void }) {
  return <button class="go" onClick={() => props.onPress()}>go</button>;
}
export function Page() {
  const n = signal(0);
  const add = (by: number) => n.set(n() + by);
  
  return (
    <section>
      <span class="out">{n()}</span>
      <Child onPress={add.bind(null, 2)} />
    </section>
  );
}`,
    expect: ["0", "2"],
    today: "pass",
  },
  {
    id: "bound-const-in-object",
    group: "shape",
    title: "a bound const stored by name in an object and an array",
    source: page(
      "const add = (by: number) => n.set(n() + by); const inc = add.bind(null, 2); const api = { inc }; const list = [inc];",
      "(n() ? list[0] : api.inc)()",
    ),
    expect: ["0", "2"],
    today: "pass",
  },
  {
    id: "two-groups-one-list",
    group: "closure",
    title: "two mutual-recursion groups declared in one statement list",
    source: page(
      "function even(k: number): boolean { return k === 0 ? true : odd(k - 1); } function odd(k: number): boolean { return k === 0 ? false : even(k - 1); } function ping(k: number): number { return k <= 0 ? 0 : pong(k - 1); } function pong(k: number): number { return k <= 0 ? 5 : ping(k - 1); }",
      "n.set(even(4) ? ping(1) : -1)",
    ),
    expect: ["0", "5"],
    today: "pass",
  },
  {
    id: "prop-fn-into-map",
    group: "library",
    title: "function prop passed into Array#map inside a handler (must stay sync)",
    source: `
import { signal } from "@rivetjs/reactivity";
function List(props: { format: (x: number) => string }) {
  const out = signal("idle");
  return (
    <section>
      <span class="out">{out()}</span>
      <button class="go" onClick={() => out.set([1, 2].map(props.format).join(","))}>go</button>
    </section>
  );
}
export function Page() {
  return <List format={(x) => "#" + x} />;
}`,
    expect: ["idle", "#1,#2"],
    today: "pass",
  },
  {
    id: "comparator-sort",
    group: "library",
    title: "local comparator passed to Array#sort inside a handler (sync)",
    source: `
import { signal } from "@rivetjs/reactivity";
export function Page() {
  const xs = signal([3, 1, 2]);
  const byDesc = (a: number, b: number) => b - a;
  return (
    <section>
      <span class="out">{xs().join(",")}</span>
      <button class="go" onClick={() => xs.set([...xs()].sort(byDesc))}>go</button>
    </section>
  );
}`,
    expect: ["3,1,2", "3,2,1"],
    today: "pass",
  },
  // ── narrow captures (state bytes) ───────────────────────────────────────────────────────────────────────────
  {
    id: "narrow-object",
    group: "narrow",
    title: "handler uses store.count only — the store's big field must not serialize",
    source: page('const store = { count: n, blob: "BIGDATA".repeat(50) };', "store.count.set(store.count() + 1)"),
    expect: ["0", "1"],
    absent: ["BIGDATA"],
    today: "pass",
  },
  {
    id: "narrow-store",
    group: "narrow",
    title: "createStore: handler writes `count` — the unread `blob` path must not serialize",
    source: `
import { createStore, read, write } from "@rivetjs/reactivity/store";
export function Page() {
  const store = createStore({ count: 0, blob: "BIGDATA".repeat(50) });
  return (
    <section>
      <span class="out">{read(store, "count")}</span>
      <button class="go" onClick={() => write(store, "count", (c: number) => c + 1)}>go</button>
    </section>
  );
}`,
    expect: ["0", "1"],
    absent: ["BIGDATA"],
    // Function Bridge T13 (C11): the compiler marks the store with its literal paths (`_rStorePaths`, runtime T12).
    today: "pass",
  },
  {
    id: "store-paths-union",
    group: "narrow",
    title: "two handlers write two paths of one store — both paths ship, the unread blob does not",
    source: `
import { createStore, read, write } from "@rivetjs/reactivity/store";
export function Page() {
  const store = createStore({ count: 0, user: { name: "ada" }, blob: "BIGDATA".repeat(50) });
  return (
    <section>
      <span class="out">{read(store, "count")}:{read(store, "user.name")}</span>
      <button class="go" onClick={() => write(store, "count", (c: number) => c + 1)}>go</button>
      <button class="b" onClick={() => write(store, "user.name", (n: string) => n + "!")}>b</button>
    </section>
  );
}`,
    steps: [".go", ".b"],
    expect: ["0:ada", "1:ada", "1:ada!"],
    absent: ["BIGDATA"],
    today: "pass",
  },
  {
    id: "store-paths-browser-read",
    group: "narrow",
    title: "a handler reads a path the server never read — its literal path ships",
    source: `
import { signal } from "@rivetjs/reactivity";
import { createStore, read } from "@rivetjs/reactivity/store";
export function Page() {
  const out = signal("idle");
  const store = createStore({ user: { name: "ada", bio: "LONGBIO" }, blob: "BIGDATA".repeat(50) });
  return (
    <section>
      <span class="out">{out()}</span>
      <button class="go" onClick={() => out.set(read(store, "user.bio"))}>go</button>
    </section>
  );
}`,
    expect: ["idle", "LONGBIO"],
    absent: ["BIGDATA", "ada"],
    today: "pass",
  },
  {
    id: "store-paths-view",
    group: "narrow",
    title: "a view (at) captured by a handler — its subtree ships, sibling rows do not",
    source: `
import { createStore, read, write, at } from "@rivetjs/reactivity/store";
export function Page() {
  const store = createStore({ todos: [{ title: "BIGDATA".repeat(50), done: false }, { title: "b", done: false }] });
  const row = at(store, "todos.1");
  return (
    <section>
      <span class="out">{read(row, "done") ? "yes" : "no"}</span>
      <button class="go" onClick={() => write(row, "done", (d: boolean) => !d)}>go</button>
    </section>
  );
}`,
    expect: ["no", "yes"],
    absent: ["BIGDATA"],
    today: "pass",
  },
  {
    id: "store-paths-view-escape",
    group: "narrow",
    title: "a view's root store read through `view.s` keeps the whole store (T13 fix round 1)",
    source: `
import { createStore, read, at } from "@rivetjs/reactivity/store";
export function Page() {
  const store = createStore({ user: { name: "a" }, list: [1, 2] });
  const u = at(store, "user");
  return (
    <section>
      <span class="out">{read(u, "name")}</span>
      <button class="go" onClick={() => (document.querySelector(".out")!.textContent = String(read(u.s as never, "list.1")))}>go</button>
    </section>
  );
}`,
    expect: ["a", "2"],
    today: "pass",
  },
  {
    id: "store-paths-view-dynamic-at",
    group: "narrow",
    title: "a dynamic at below a view ships the view's whole subtree (T13 fix round 2)",
    source: `
import { createStore, read, at } from "@rivetjs/reactivity/store";
export function Page() {
  const store = createStore({ user: { name: { first: "a" }, bio: { first: "BIO" } }, other: "BIGDATA".repeat(50) });
  const u = at(store, "user");
  const keys = ["bio"];
  const w = at(u, keys[0] as never);
  return (
    <section>
      <span class="out">-</span>
      <button class="go" onClick={() => (document.querySelector(".out")!.textContent = String(read(w, "first" as never)))}>go</button>
    </section>
  );
}`,
    expect: ["-", "BIO"],
    absent: ["BIGDATA"],
    today: "pass",
  },
  {
    id: "store-paths-dynamic",
    group: "narrow",
    title: "a dynamic path keeps the whole store (control: correct, whole data ships)",
    source: `
import { createStore, read, write } from "@rivetjs/reactivity/store";
export function Page() {
  const store = createStore({ count: 0, blob: "WHOLEDATA" });
  const key = "count";
  return (
    <section>
      <span class="out">{read(store, "count")}</span>
      <button class="go" onClick={() => write(store, key as "count", (c: number) => c + 1)}>go</button>
    </section>
  );
}`,
    expect: ["0", "1"],
    today: "pass",
  },
  {
    id: "narrow-props",
    group: "narrow",
    title: "child handler reads props.item.id — the item's big field must not serialize",
    source: `
import { signal } from "@rivetjs/reactivity";
function Card(props: { item: { id: number; body: string } }) {
  const out = signal("idle");
  return (
    <section>
      <span class="out">{out()}</span>
      <button class="go" onClick={() => out.set("id" + props.item.id)}>go</button>
    </section>
  );
}
export function Page() {
  return <Card item={{ id: 7, body: "BIGDATA".repeat(50) }} />;
}`,
    expect: ["idle", "id7"],
    absent: ["BIGDATA"],
    today: "pass",
  },
  // Function Bridge T11 fix round 1: narrowing must not change `this`, inherited keys or live props (executed).
  {
    id: "method-this-const-fn",
    group: "this",
    title: "a `const` function expression using `this`, stored by shorthand and called through the object",
    source: page("const inc = function (this: any) { this.count.set(this.count() + 1); }; const store = { count: n, inc };", "store.inc()"),
    expect: ["0", "1"],
    today: "pass",
  },
  {
    id: "method-this-import",
    group: "this",
    title: "an imported function using `this`, called through the object",
    source: page("const store = { count: n, inc: ext };", "store.inc()", 'import { ext } from "fake-this";'),
    libs: { "fake-this": "export function ext() { this.count.set(this.count() + 1); }" },
    expect: ["0", "1"],
    today: "pass",
  },
  {
    id: "method-this-member",
    group: "this",
    title: "another object's method stored as a value, called through the object",
    source: page("const base = { inc() { this.count.set(this.count() + 1); } }; const store = { count: n, inc: base.inc };", "store.inc()"),
    expect: ["0", "1"],
    // A method read off another object (`base.inc`) does not encode (as before T11); T11 keeps `store` whole, so the
    // failure is the honest render error, not a narrowed `this`.
    today: "render",
    note: "function is not serializable",
  },
  {
    id: "method-this-proto",
    group: "this",
    title: "a `__proto__` method using `this`, called through the object",
    source: page("const store: any = { __proto__: { inc() { this.count.set(this.count() + 1); } }, count: n };", "store.inc()"),
    expect: ["0", "1"],
    today: "pass",
  },
  {
    id: "narrow-own-keys",
    group: "narrow",
    title: "an inherited key (`hasOwnProperty`) read through the object keeps the whole object",
    source: page('const store = { count: n, blob: "B" };', 'n.set(store.hasOwnProperty("count") ? n() + 1 : 0)'),
    expect: ["0", "1"],
    today: "pass",
  },
  {
    id: "narrow-fn-symbol",
    group: "narrow",
    title: "a local function reading store.count — its symbol captures the path only",
    source: page('const store = { count: n, blob: "BIGDATA".repeat(50) }; const inc = () => store.count.set(store.count() + 1);', "inc()"),
    expect: ["0", "1"],
    absent: ["BIGDATA"],
    today: "pass",
  },
  {
    id: "narrow-bind-object",
    group: "narrow",
    title: "a binding reading store.label() — the big field must not serialize",
    source: page(
      'const store = { label: computed(() => "n" + n()), blob: "BIGDATA".repeat(50) };',
      "n.set(n() + 1)",
      'import { computed } from "@rivetjs/reactivity";',
      "{store.label()}",
    ),
    expect: ["n0", "n1"],
    absent: ["BIGDATA"],
    today: "pass",
  },
  {
    id: "narrow-props-object",
    group: "narrow",
    title: "child handler uses the object prop props.item as a value — its big field must not serialize",
    source: `
import { signal } from "@rivetjs/reactivity";
function Card(props: { item: { id: number; body: string } }) {
  const out = signal("idle");
  return (
    <section>
      <span class="out">{out()}</span>
      <button class="go" onClick={() => out.set("id" + JSON.parse(JSON.stringify(props.item)).id)}>go</button>
    </section>
  );
}
export function Page() {
  return <Card item={{ id: 7, body: "BIGDATA".repeat(50) }} />;
}`,
    expect: ["idle", "id7"],
    absent: ["BIGDATA"],
    today: "pass",
  },
  {
    id: "narrow-props-live",
    group: "narrow",
    title: "child handler calls a live function prop narrowed per member; the prop changes after resume",
    source: `
import { signal } from "@rivetjs/reactivity";
function Card(props: { act: () => void }) {
  return <button class="go" onClick={() => props.act()}>go</button>;
}
export function Page() {
  const out = signal("idle");
  const mode = signal(0);
  const a = () => out.set("A");
  const b = () => out.set("B");
  return (
    <section>
      <span class="out">{out()}</span>
      <button class="flip" onClick={() => mode.set(1)}>flip</button>
      <Card act={mode() ? b : a} />
    </section>
  );
}`,
    steps: [".go", ".flip", ".go"],
    expect: ["idle", "A", "A", "B"],
    today: "pass",
  },
  // ── class instances ─────────────────────────────────────────────────────────────────────────────────────────
  {
    id: "data-class",
    group: "class",
    title: "data-only class instance (ObjectId-like) — method after resume",
    source: page(
      'const id = new ObjectId("65f0");',
      'n.set(id.toString() === "ObjectId(65f0)" ? 1 : -1)',
      'class ObjectId { hex: string; constructor(hex: string) { this.hex = hex; } toString() { return "ObjectId(" + this.hex + ")"; } }',
    ),
    expect: ["0", "1"],
    today: "pass",
  },
  {
    id: "data-class-no-constructor",
    group: "class",
    title: "a restored data class instance never runs its constructor in the browser (review T24 L3)",
    source: page(
      'const tag = new Tag("a");',
      'n.set(tag.name === "a" && made === 0 ? 1 : -1)',
      "let made = 0; class Tag { name: string; constructor(name: string) { made++; this.name = name; } }",
    ),
    expect: ["0", "1"],
    today: "pass",
  },
  {
    id: "data-class-private",
    group: "class",
    title: "data class with a #private field",
    source: page(
      "const money = new Money(250);",
      "n.set(money.cents())",
      "class Money { #c: number; constructor(c: number) { this.#c = c; } cents() { return this.#c; } }",
    ),
    expect: ["0", "250"],
    today: "compile",
    // D-priv (T24): `#private` fields cannot be restored without the constructor. Correct outcome (spec §Data classes,
    // T30): the named error — the class needs `static [revive]` (case data-class-private-revive).
    note: "Cannot resume `money\\.#c`: Money instance has a private field",
    bridge: { status: "compile", message: "Cannot resume `money\\.#c`: Money instance has a private field" },
  },
  {
    id: "data-class-private-revive",
    group: "class",
    title: "data class with a #private field and `[serialize]` / `static [revive]` (T25): rebuilt by its reviver",
    source: page(
      "const money = new Money(250);",
      "n.set(money.cents())",
      'import { revive, serialize } from "@rivetjs/runtime/resume-format";\nclass Money { #c: number; constructor(c: number) { this.#c = c; } cents() { return this.#c; } [serialize]() { return this.#c; } static [revive](c: number) { return new Money(c); } }',
    ),
    expect: ["0", "250"],
    today: "pass",
  },
  {
    id: "data-class-nested",
    group: "class",
    title: "array of data class instances in a signal (ORM rows)",
    source: page(
      'const rows = signal([new User("ada"), new User("bo")]);',
      'n.set(rows().map((u) => u.initial()).join("") === "AB" ? 1 : -1)',
      "class User { name: string; constructor(name: string) { this.name = name; } initial() { return this.name[0]!.toUpperCase(); } }",
    ),
    expect: ["0", "1"],
    today: "pass",
  },
  {
    id: "resource-class",
    group: "class",
    title: "resource holder (socket-like): must be reconstructed in the browser, not serialized",
    source: page(
      'const conn = new Conn("wss://x");',
      "n.set(conn.send() ? 1 : -1)",
      'class Conn { url: string; live: boolean; constructor(url: string) { this.url = url; this.live = typeof window !== "undefined"; } send() { return this.live; } }',
    ),
    expect: ["0", "1"],
    today: "compile",
    note: "Cannot resume `conn\\.live`: Conn instance holds a resource",
    bridge: { status: "compile", message: "Cannot resume `conn\\.live`: Conn instance holds a resource" },
  },
  {
    id: "library-object",
    group: "library",
    title: "library object (chart-like, from a non-resume package) captured by a handler",
    source: page("const chart = createChart(4);", "n.set(chart.size())", 'import { createChart } from "fake-chart";'),
    libs: { "fake-chart": "export function createChart(size) { return { size: () => size, browser: typeof window !== 'undefined' }; }" },
    expect: ["0", "4"],
    today: "render",
    note: "function is not serializable.*reconstruct\\(",
    bridge: { status: "render", message: "function is not serializable.*reconstruct\\(" },
  },
  {
    id: "library-fn",
    group: "library",
    title: "imported npm function referenced by a handler (module scope import)",
    source: page("", "n.set(double(n() + 1))", 'import { double } from "fake-util";'),
    libs: { "fake-util": "export const double = (x) => x * 2;" },
    expect: ["0", "2"],
    today: "pass",
  },
  {
    id: "library-fn-in-object",
    group: "library",
    title: "imported npm function stored in an object",
    source: page("const opts = { double };", "n.set(opts.double(n() + 1))", 'import { double } from "fake-util";'),
    libs: { "fake-util": "export const double = (x) => x * 2;" },
    expect: ["0", "2"],
    today: "pass",
  },
  {
    id: "library-closure",
    group: "library",
    title: "closure created by a non-resume library (memoize(fn)) captured by a handler",
    source: page("const inc = memo(() => n.set(n() + 1));", "inc()", 'import { memo } from "fake-util";'),
    libs: { "fake-util": "export const memo = (f) => (...a) => f(...a);" },
    expect: ["0", "1"],
    today: "pass",
  },
  // ── built-ins ────────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: "map-data",
    group: "builtin",
    title: "Map of data",
    source: page('const m = new Map([["a", 4]]);', 'n.set(m.get("a")!)'),
    expect: ["0", "4"],
    today: "pass",
  },
  {
    id: "set-data",
    group: "builtin",
    title: "Set of data",
    source: page("const s = new Set([1, 2, 3]);", "n.set(s.has(2) ? s.size : -1)"),
    expect: ["0", "3"],
    today: "pass",
  },
  {
    id: "date",
    group: "builtin",
    title: "Date",
    source: page('const d = new Date("2026-10-09T00:00:00Z");', "n.set(d.getUTCDate())"),
    expect: ["0", "9"],
    today: "pass",
  },
  {
    id: "url",
    group: "builtin",
    title: "URL",
    source: page('const u = new URL("https://x.test/a/b?q=1");', 'n.set(u.searchParams.get("q") === "1" ? u.pathname.length : -1)'),
    expect: ["0", "4"],
    today: "pass",
  },
  {
    id: "regexp",
    group: "builtin",
    title: "RegExp",
    source: page("const re = /a+/g;", 'n.set(re.test("caab") ? re.lastIndex : -1)'),
    expect: ["0", "3"],
    today: "pass",
  },
  {
    id: "bigint",
    group: "builtin",
    title: "bigint",
    source: page("const b = 41n;", "n.set(Number(b + 1n))"),
    expect: ["0", "42"],
    today: "pass",
  },
  {
    id: "null-proto",
    group: "builtin",
    title: "null-prototype object (JSON.parse reviver / ORM row)",
    source: page("const row = Object.assign(Object.create(null) as { k: number }, { k: 6 });", "n.set(row.k)"),
    expect: ["0", "6"],
    today: "pass",
  },
  {
    id: "typed-array",
    group: "builtin",
    title: "Uint8Array",
    source: page("const bytes = new Uint8Array([1, 2, 3]);", "n.set(bytes.length + bytes[2]!)"),
    expect: ["0", "6"],
    today: "pass",
  },
  // ── structure ────────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: "jsx-content-prop",
    group: "context",
    title: "JSX content prop shown by a closed overlay after resume",
    source: `
import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
function Panel(props: { open: boolean; body: unknown }) {
  return <Show when={props.open}>{() => props.body}</Show>;
}
export function Page() {
  const open = signal(false);
  return (
    <section>
      <span class="out">
        <Panel open={open()} body={<b>hi</b>} />
      </span>
      <button class="go" onClick={() => open.set(true)}>go</button>
    </section>
  );
}`,
    expect: ["", "hi"],
    today: "pass",
  },
  {
    id: "closed-overlay-plain-children",
    group: "context",
    title: "plain JSX children (not a render function) of a closed overlay with a handler inside",
    source: `
import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
function Overlay(props: { open: boolean; children?: unknown }) {
  return <Show when={props.open}>{props.children}</Show>;
}
export function Page() {
  const open = signal(false);
  const n = signal(0);
  return (
    <section>
      <span class="out">{n()}</span>
      <button class="go" onClick={() => open.set(true)}>go</button>
      <Overlay open={open()}>
        <button class="inc" onClick={() => n.set(n() + 1)}>inc</button>
      </Overlay>
    </section>
  );
}`,
    steps: [".go", ".inc"],
    expect: ["0", "0", "1"],
    today: "pass",
  },
  // ── Function Bridge additions (plan T1) ────────────────────────────────────────────────────────────────────────
  {
    id: "recipe-side-effect",
    group: "closure",
    title: "recipe const holding only References: its initializer must not run again in the browser (Q5)",
    source: page(
      "const fns = track([() => n.set(n() + 1)]);",
      "fns[0]!()",
      "function track<T>(x: T): T { const g = globalThis as { __inits?: number }; g.__inits = (g.__inits ?? 0) + 1; return x; }",
    ),
    read: `document.querySelector(".out").textContent + ":" + (window.__inits ?? 0)`,
    expect: ["0:0", "1:0"],
    today: "pass",
  },
  {
    id: "resource-reconstruct",
    group: "class",
    title: "resource holder built by reconstruct(() => new Conn(url)): lazy, in the browser",
    source: page(
      'const conn = reconstruct(() => new Conn("wss://x"));',
      "n.set(conn().send() ? 1 : -1)",
      'import { reconstruct } from "@rivetjs/runtime/dom";\nclass Conn { url: string; live: boolean; constructor(url: string) { this.url = url; this.live = typeof window !== "undefined"; } send() { return this.live; } }',
    ),
    expect: ["0", "1"],
    // T27 (C14): a computed site with equals: false; the factory runs in the browser on first read (no value encoded).
    today: "pass",
  },
  {
    id: "resource-revive",
    group: "class",
    title: "resource holder with [serialize]() + static [revive](data): rebuilt from its data",
    source: page(
      'const conn = new Conn("wss://x");',
      'n.set(conn.send() && conn.url === "wss://x" ? 1 : -1)',
      'import { revive, serialize } from "@rivetjs/runtime/resume-format";\nclass Conn { url: string; live: boolean; constructor(url: string) { this.url = url; this.live = typeof window !== "undefined"; } send() { return this.live; } [serialize]() { return { url: this.url }; } static [revive](data: { url: string }) { return new Conn(data.url); } }',
    ),
    expect: ["0", "1"],
    // T25: `[serialize]` data `{url}` travels (`{cls, a: [data], rv: 1}`); `static [revive]` rebuilds a live Conn on first use.
    today: "pass",
  },
  {
    id: "library-object-reconstruct",
    group: "library",
    title: "library object built by reconstruct(() => createChart(4))",
    source: page(
      "const chart = reconstruct(() => createChart(4));",
      "n.set(chart().size())",
      'import { reconstruct } from "@rivetjs/runtime/dom";\nimport { createChart } from "fake-chart";',
    ),
    libs: { "fake-chart": "export function createChart(size) { return { size: () => size, browser: typeof window !== 'undefined' }; }" },
    expect: ["0", "4"],
    // T27 (C14): a computed site with equals: false; the factory runs in the browser on first read (no value encoded).
    today: "pass",
  },
  // ── deploy skew ─────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: "skew-renumbered",
    group: "skew",
    title: "chunks from the next deploy (a handler inserted before): the old page must never run the wrong function",
    source: `
import { signal } from "@rivetjs/reactivity";
export function Page() {
  const out = signal("idle");
  return (
    <section>
      <span class="out">{out()}</span>
      <button class="go" onClick={() => out.set("go")}>go</button>
    </section>
  );
}`,
    domSource: `
import { signal } from "@rivetjs/reactivity";
export function Page() {
  const out = signal("idle");
  return (
    <section>
      <span class="out">{out()}</span>
      <button class="new" onClick={() => out.set("WRONG")}>new</button>
      <button class="go" onClick={() => out.set("go")}>go</button>
    </section>
  );
}`,
    // Correct: either the right handler (content-stable id found in the new chunk) or a detected mismatch — never "WRONG".
    read: `document.querySelector(".out").textContent.replace("go", "ok") + (window.__resumeError ? ":skew" : "")`,
    expect: ["idle", "ok"],
    today: "pass",
  },
  {
    id: "skew-changed",
    group: "skew",
    title: "chunks from the next deploy where the handler's own code changed: the old id is missing — fail-safe reload, never another function",
    source: `
import { signal } from "@rivetjs/reactivity";
export function Page() {
  const out = signal("idle");
  return (
    <section>
      <span class="out">{out()}</span>
      <button class="go" onClick={() => out.set("go")}>go</button>
    </section>
  );
}`,
    domSource: `
import { signal } from "@rivetjs/reactivity";
export function Page() {
  const out = signal("idle");
  return (
    <section>
      <span class="out">{out()}</span>
      <button class="go" onClick={() => out.set("WRONG")}>go</button>
    </section>
  );
}`,
    // The loader's `rivet:resume-error` (canceled by the probe, so no reload) and no handler ran.
    read: `document.querySelector(".out").textContent + (window.__resumeError ? ":skew" : "")`,
    expect: ["idle", "idle:skew"],
    today: "pass",
  },
  {
    id: "accessor-return-row",
    group: "shape",
    title: "a component returning an accessor inside a For row re-runs it on change (RESUME-ACCESSOR-ROW, server `_rChild`)",
    source: `
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
function Panel(props: { id: number; sel: () => number }) {
  return () => (props.sel() === props.id ? <li>on {props.id}</li> : <li>off {props.id}</li>);
}
export function Page() {
  const sel = signal(1);
  const rows = signal([1, 2]);
  return (
    <section>
      <ul class="out"><For each={rows()} by={(r) => r}>{(r) => <Panel id={r()} sel={sel} />}</For></ul>
      <button class="go" onClick={() => sel.set(2)}>go</button>
    </section>
  );
}`,
    expect: ["on 1off 2", "off 1on 2"],
    today: "pass",
  },
  {
    id: "accessor-return-ternary",
    group: "shape",
    title: "a component returning one of two accessors (`c ? () => a : () => b`) re-runs the chosen one (RESUME-ACCESSOR-ROW fix 1)",
    source: `
import { signal } from "@rivetjs/reactivity";
function View(props: { compact: boolean; n: () => number }) {
  return props.compact ? () => <b>c{props.n()}</b> : () => <i>w{props.n()}</i>;
}
export function Page() {
  const n = signal(0);
  return (
    <section>
      <span class="out"><View compact={true} n={n} /></span>
      <button class="go" onClick={() => n.set(n() + 1)}>go</button>
    </section>
  );
}`,
    expect: ["c0", "c1"],
    today: "pass",
  },
  {
    id: "accessor-return-named",
    group: "shape",
    title: "a component returning a local const arrow by name (`const view = () => …; return view`) re-runs it (RESUME-ACCESSOR-ROW fix 1)",
    source: `
import { signal } from "@rivetjs/reactivity";
function View(props: { n: () => number }) {
  const view = () => (props.n() > 0 ? <b>many {props.n()}</b> : <i>none</i>);
  return view;
}
export function Page() {
  const n = signal(0);
  return (
    <section>
      <span class="out"><View n={n} /></span>
      <button class="go" onClick={() => n.set(n() + 1)}>go</button>
    </section>
  );
}`,
    expect: ["none", "many 1"],
    today: "pass",
  },
  {
    id: "accessor-return-hoisted",
    group: "shape",
    title: "a For row component returning a hoisted `function view() {}` by name re-runs it (RESUME-ACCESSOR-ROW fix 2)",
    source: `
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
function View(props: { n: () => number }) {
  return view;
  function view() {
    return props.n() > 0 ? <b>many {props.n()}</b> : <i>none</i>;
  }
}
export function Page() {
  const n = signal(0);
  return (
    <section>
      <span class="out"><For each={[1]} by={(x) => x}>{() => <View n={n} />}</For></span>
      <button class="go" onClick={() => n.set(n() + 1)}>go</button>
    </section>
  );
}`,
    expect: ["none", "many 1"],
    today: "pass",
  },
];
