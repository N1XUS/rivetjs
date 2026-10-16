// Wave-2 resume compiler fixes (scratchpad specs resume-bugs.md §4/§5/§6/§7, dom-v2-spread.md §3):
// member-read captures of spread / styled sites, DOM-prop projections, conditional handler presence,
// capture-phase handlers, self-referencing const arrows.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile, check } from "../index.ts";

const resume = { module: "src/m.tsx" };
const both = (source: string) => {
  const server = compile(source, { target: "server", filename: "m.tsx", resume });
  const dom = compile(source, { target: "dom", filename: "m.tsx", resume });
  assert.deepEqual(server.diagnostics, []);
  assert.deepEqual(dom.diagnostics, []);
  assert.deepEqual(
    server.symbols!.map((s) => [s.id, s.captures]),
    dom.symbols!.map((s) => [s.id, s.captures]),
  );
  return { server, dom };
};
/** Emitted code on one line (objects / arrays print multi-line). */
const flat = (code: string) => code.replace(/\s+/g, " ").replace(/\[ /g, "[").replace(/ \]/g, "]");
const head = `import { signal } from "@rivetjs/reactivity";\nimport { globalDOMProps, textInputDOMProps } from "@rivetjs/cdk/dom-props";\nconst OWNED = ["onClick"];\n`;

test('spread site: `props.a` / `props["x-y"]` reads capture the members, the symbol rebuilds `props`', () => {
  const { server, dom } = both(
    head +
      `export function V(props: any, state: any) {
  const n = signal(0);
  return <div {...props.attrs} id={state.id()} data-a={props.a} data-b={props["x-y"]} data-c={props.cfg.n} class:on={n() > 0}>a</div>;
}`,
  );
  const [spread] = dom.symbols!;
  assert.equal(spread!.kind, "spread");
  assert.deepEqual(spread!.captures, ["props$attrs", "props$a", "props$x_y", "props$cfg", "state$id", "n"]);
  // User-facing names as written (T19 fix 1): dev errors and the overlay name `props.a`, never `props$a`.
  assert.deepEqual(spread!.labels, ["props.attrs", "props.a", 'props["x-y"]', "props.cfg", "state.id", "n"]);
  assert.equal(dom.symbols!.find((s) => s.captures.every((c) => !c.includes("$")))?.labels, undefined);
  assert.equal(
    spread!.source,
    `export const V$fpn = (props$attrs, props$a, props$x_y, props$cfg, state$id, n) => { const props = __rivetMembers({ attrs: props$attrs, a: props$a, "x-y": props$x_y, cfg: props$cfg }); const state = __rivetMembers({ id: state$id }); return (__rivetEl, __rivetNames) => __rivetResumeSpread(__rivetEl, () => __rivetResumeSpreadClass({ ...(props.attrs), "id": (state.id()), "data-a": (props.a), "data-b": (props["x-y"]), "data-c": (props.cfg.n) }, { "on": (n() > 0) }), 0, __rivetNames); };\n`,
  );
  // Server: the member values are the captures (evaluated when the merged object is read); `_rMember` boxes a
  // live prop (LIVE-PROPS P3) instead of reading it, `_members` turns boxes back into getters in the symbol.
  assert.match(
    flat(server.code),
    /__rivetR_spread\("src\/m\.tsx#V\$\w+", \(\) => __rivetSpreadClass\(\{.*?\}\), \[__rivetR_member\(props, "attrs"\), __rivetR_member\(props, "a"\), __rivetR_member\(props, "x-y"\), __rivetR_member\(props, "cfg"\), __rivetR_member\(state, "id"\), n\], "div"\)/,
  );
  // Editor sites name the member captures with the member expression spans.
  const site = check(head + `export function V(props: any) { return <div {...props.attrs} data-a={props.a}>a</div>; }`, {
    filename: "m.tsx",
    resume,
  }).sites!.find((s) => s.kind === "spread")!;
  assert.deepEqual(
    site.captures.map((c) => c.name),
    ["props.attrs", "props.a"],
  );
});

test("spread site: whole-value uses keep the whole capture (call argument, bare spread, write, delete, computed key)", () => {
  const cases: [string, string[]][] = [
    [`<div {...f(props)} data-a={props.a}>a</div>`, ["props"]],
    [`<div {...props} title={n()}>a</div>`, ["props", "n"]],
    [`<div {...props.attrs} title={(props.a = n())}>a</div>`, ["props", "n"]],
    [`<div {...props.attrs} title={delete props.a}>a</div>`, ["props"]],
    [`<div {...props.attrs} data-a={props[key]}>a</div>`, ["props"]],
    [`<div {...props.attrs} data-a={props?.a}>a</div>`, ["props"]], // optional chain: the guard belongs to the read
    [`<div {...props.attrs} data-b={(props as any).b} data-c={props!.c}>a</div>`, ["props$attrs", "props$b", "props$c"]],
  ];
  for (const [jsx, captures] of cases) {
    const { dom } = both(head + `declare const f: any; declare const key: string;\nexport function V(props: any) { const n = signal(0); return ${jsx}; }`);
    assert.deepEqual(dom.symbols!.find((s) => s.kind === "spread")!.captures, captures, jsx);
  }
});

test("spread / styled sites: `globalDOMProps(props)` is a projection capture; composes with member reads", () => {
  const { server, dom } = both(
    head +
      `export function V(props: any) {
  const n = signal(0);
  return <section>
    <div {...globalDOMProps(props, OWNED)} id={props.id} title={n()}>a</div>
    <input {...textInputDOMProps(props)} value={n()} />
    <i style={{ color: props.c() + n() }}>d</i>
    <b {...globalDOMProps(props, props.owned)}>e</b>
  </section>;
}`,
  );
  const spreads = dom.symbols!.filter((s) => s.kind === "spread" || s.kind === "attr");
  assert.deepEqual(
    spreads.map((s) => s.captures),
    [["props$0", "props$id", "n"], ["props$0", "n"], ["props$c", "n"], ["props"]],
  );
  assert.match(
    spreads[0]!.source,
    /^export const V\$\w+ = \(props\$\w+, props\$id, n\) => \{ const props = __rivetMembers\(\{ \.\.\.props\$\w+, id: props\$id \}\); return /,
  );
  assert.match(spreads[1]!.source, /^export const V\$\w+ = \(props\$\w+, n\) => \{ const props = props\$\w+; return /);
  assert.match(
    spreads[2]!.source,
    /^export const V\$\w+ = \(props\$c, n\) => \{ const props = __rivetMembers\(\{ c: props\$c \}\); return \(__rivetEl\) => \{ __rivetResumeStyle/,
  );
  assert.match(flat(server.code), /\[globalDOMProps\(props, OWNED\), __rivetR_member\(props, "id"\), n\], "div"/);
  assert.match(flat(server.code), /\[textInputDOMProps\(props\), n\], "input"/);
  assert.match(flat(server.code), /\[__rivetR_member\(props, "c"\), n\], "i"/);
  // Function Bridge T11: a handler narrows the props members it calls (`props$onPress`, rebuilt through `__rivetMembers`).
  const { dom: events } = both(head + `export function V(props: any) { return <button onClick={() => props.onPress()}>a</button>; }`);
  assert.deepEqual(events.symbols![0]!.captures, ["props$onPress"]);
});

test("conditional handlers pass their presence test; `onXCapture` records a capture-phase handler", () => {
  const { server, dom } = both(
    head +
      `export function Cond(props: { onReset?: (e: Event) => void; cfg: { on?: () => void } }) {
  const n = signal(0);
  return <form onReset={props.onReset ? (e) => props.onReset!(e) : undefined} onSubmit={props.cfg.on && (() => props.cfg.on!())}
    onClick={!props.onReset ? undefined : () => n.set(1)} onKeyDown={typeof n === "function" ? () => 1 : undefined} onInput={props.onReset ? () => 1 : () => 2}
    onPointerDownCapture={() => n.set(2)} preload="intent">x</form>;
}`,
  );
  const calls = [...flat(server.code).matchAll(/__rivetR_on\(.*?\)(?=, )/g)].map((m) => m[0]);
  assert.deepEqual(calls, [
    `__rivetR_on("reset", "src/m.tsx#Cond$aub", __rivetCaps, { preload: "intent" }, !!props.onReset)`,
    `__rivetR_on("submit", "src/m.tsx#Cond$oij", __rivetCaps, { preload: "intent" }, !!props.cfg.on)`,
    `__rivetR_on("click", "src/m.tsx#Cond$ksa", [props, n], { preload: "intent" }, !!props.onReset)`,
    // A non-trivial test (no call: a reactive `n() ? … : …` is RV1016) and a two-handler conditional: always recorded. Equal capture lists share
    // one per-render array (SRV-ROWFN).
    `__rivetR_on("keydown", "src/m.tsx#Cond$xyb", __rivetCaps_, { preload: "intent" })`,
    `__rivetR_on("input", "src/m.tsx#Cond$nda", __rivetCaps, { preload: "intent" })`,
    `__rivetR_on("pointerdown", "src/m.tsx#Cond$y4o", __rivetCaps_, { preload: "intent", capture: 1 })`,
  ]);
  const plain = compile(head + `export function C(props: any) { return <b onClick={props.f && (() => 1)} onFocusCapture={() => 2}>x</b>; }`, {
    target: "server",
    filename: "m.tsx",
    resume,
  });
  assert.deepEqual(plain.diagnostics, []);
  assert.match(plain.code, /__rivetR_on\("click", "src\/m\.tsx#C\$\w+", \[props\], undefined, !!props\.f\)/);
  assert.match(plain.code, /__rivetR_on\("focus", "src\/m\.tsx#C\$\w+", \[\], \{ capture: 1 \}\)/);
  // The DOM symbol is the whole conditional (correct whichever branch the server took).
  assert.equal(dom.symbols![0]!.source, `export const ${dom.symbols![0]!.name} = (props) => (props.onReset ? (e) => props.onReset!(e) : undefined);\n`);
  assert.equal(dom.symbols![5]!.kind, "event");
});

test("a const arrow referring to itself is not its own capture; the symbol binds the name", () => {
  const { server, dom } = both(
    head +
      `export function Rec() {
  const n = signal(3);
  const fact = (k: number): number => (k <= 1 ? 1 : k * fact(k - 1));
  function fib(k: number): number { return k < 2 ? k : fib(k - 1) + fib(k - 2); }
  return <p onClick={() => n.update((v) => v + 1)}>{fact(n())}{fib(n())}</p>;
}`,
  );
  assert.match(server.code, /const fact = __rivetR_fn\("src\/m\.tsx#Rec\$\w+", \(k\) => k <= 1 \? 1 : k \* fact\(k - 1\), \[\]\)/);
  const [fact, fib] = dom.symbols!;
  assert.deepEqual(fact!.captures, []);
  assert.equal(fact!.source, `export const Rec$uv6 = () => { const fact = ((k: number): number => (k <= 1 ? 1 : k * fact(k - 1))); return fact; };\n`);
  assert.deepEqual(fib!.captures, []);
  assert.match(fib!.source, /^export const Rec\$\w+ = \(\) => \(function fib\(k: number\): number \{/);
});

test("optional member reads capture the object itself (the guard stays in the read)", () => {
  const source = `import { signal } from "@rivetjs/reactivity";
export function G(props: { hover: null | { isHovered(): boolean; k: string }; attrs: object }) {
  const hover = props.hover;
  const n = signal(1);
  return <div {...props.attrs} data-h={hover?.isHovered() ? "t" : undefined} data-k={hover?.["k"]} data-n={n()} title={hover?.k}><i data-a={hover?.k + n()} style={{ color: hover?.k }} /></div>;
}`;
  const server = compile(source, { target: "server", filename: "g.tsx", resume: { module: "g" } });
  assert.deepEqual(server.diagnostics, []);
  assert.deepEqual(
    server.symbols!.map((s) => [s.kind, s.captures]),
    [
      ["spread", ["props$attrs", "hover", "n"]],
      ["attr", ["hover", "n"]],
    ],
  );
  const code = flat(server.code);
  assert.match(
    code,
    /__rivetR_spread\("g#G\$\w+", \(\) => \(\{ \.\.\.props\.attrs, "data-h": hover\?\.isHovered\(\) \? "t" : undefined, "data-k": hover\?\.\["k"\], "data-n": n\(\), "title": hover\?\.k \}\), \[__rivetR_member\(props, "attrs"\), hover, n\], "div"\)/,
  );
  assert.match(
    code,
    /const __rivetRead\d+ = \(__rivetCaps\) => \{ const hover = __rivetCaps\[0\], n = __rivetCaps\[1\]; return hover\?\.k \+ n\(\); \};[^]*__rivetR_attr\("data-a", "g#G\$\w+", __rivetRead\d+, \[hover, n\]\)/,
  );
  assert.doesNotMatch(code, /hover\.isHovered|hover\.k\b|hover\["k"\]/);
});
