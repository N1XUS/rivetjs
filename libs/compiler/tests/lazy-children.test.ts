import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";

// Lazy component children: plain JSX children of a component element compile to a thunk the
// component calls where it renders them (after its providers), on every target.
const resume = { module: "src/m.tsx" };
const targets = ["server", "dom"] as const;

test("element / expression children of a component become a thunk; text-only children stay a string", () => {
  for (const target of targets) {
    const r = compile(
      `import { Card, Button } from "./ui.tsx";
export const view = (x: string) => <div>
  <Card><p>a</p>{x}</Card>
  <Button>Save</Button>
  <Card>{x}</Card>
  <Card>{() => <p>fn</p>}</Card>
  <Card>{(close: () => void) => <p>render</p>}</Card>
</div>;`,
      { target, filename: "m.tsx" },
    );
    assert.deepEqual(r.diagnostics, []);
    const children = [...r.code.matchAll(/children: ([^\n]*)/g)].map((m) => m[1]);
    assert.equal(children.length, 5, r.code);
    assert.match(children[0]!, /^__rivetSlot\(\(\) => \[/, target);
    assert.match(children[1]!, /^"Save" \}\)/, target);
    assert.match(children[2]!, /^x \}/, target); // a bare reference passes through
    assert.match(children[3]!, /^\(\) => /, target); // a function child is passed as is (no brand)
    assert.doesNotMatch(children[3]!, /__rivetSlot|\(\) => \(\) =>/, target);
    assert.match(children[4]!, /^\(close\) => /, target);
  }
});

test("`Switch` children (Match markers) stay eager; every other component gets the branded thunk", () => {
  for (const target of targets) {
    const r = compile(
      `import { Switch, Match, Provider, ErrorBoundary } from "@rivetjs/runtime/${target}";
import { Card } from "./ui.tsx";
export const view = (s: () => boolean) => <div>
  <Switch fallback="none"><Match when={s}><Card><b/></Card></Match></Switch>
  <Provider token={t} value={1}><Card><b/></Card></Provider>
  <ErrorBoundary fallback={() => "x"}><i/></ErrorBoundary>
</div>;`,
      { target, filename: "m.tsx" },
    );
    assert.deepEqual(r.diagnostics, []);
    const children = [...r.code.matchAll(/children: ([^\n]*)/g)].map((m) => m[1]);
    // Switch: eager Match element; Match (non-resumed): lazy Card; Card: lazy; Provider: thunk; Card; ErrorBoundary: thunk.
    assert.match(children[0]!, target === "dom" ? /^__rivet_c\(__rivet_match, / : /^Match\(/);
    // Every other component element (Match, Card, Provider, ErrorBoundary): branded lazy children.
    for (const c of children.slice(1)) assert.match(c, /^__rivetSlot\(\(\) => /, c);
    // DOM: from the dom entry (keeps `_slot` in the dom chunk); server: the `slot` subpath.
    assert.ok(r.code.includes(`import { _slot as __rivetSlot } from "@rivetjs/runtime/${target === "dom" ? "dom" : "slot"}"`), r.code);
  }
});

test("DOM: lazy children do not make the component call reactive", () => {
  const r = compile(
    `import { Card } from "./ui.tsx";
import { signal } from "@rivetjs/reactivity";
export const view = () => { const n = signal(1); return <main><Card><b>{n()}</b></Card><Card title={n()}>x</Card></main>; };`,
    { target: "dom", filename: "m.tsx" },
  );
  assert.deepEqual(r.diagnostics, []);
  assert.match(r.code, /__rivet_c\(Card, \{ children: __rivetSlot\(\(\) => /);
  assert.match(r.code, /__rivetPropsGetter\(o, "title", 0\);\s*o\["children"\] = "x";[\s\S]*__rivet_c\(Card, __rivetProps\d+\(\(\) => n\(\)\)\)/);
});

test("resume: lazy children of a user component are a slot symbol; framework components get none", () => {
  const source = `
import { signal } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import { Card } from "./ui.tsx";
export function View(props: { label: string; children?: unknown }) {
  const n = signal(0);
  const t = { token: 1 };
  return <section>
    <Card><p onClick={() => n.update((v) => v + 1)}>{props.label}</p>{n()}</Card>
    <Card><b>{props.label}</b></Card>
    <Card>{n()}</Card>
    <Provider token={t} value={1}><i>{props.label}</i></Provider>
  </section>;
}`;
  const [server, dom] = targets.map((target) => compile(source, { target, filename: "m.tsx", resume }));
  assert.deepEqual(server!.diagnostics, []);
  assert.deepEqual(dom!.diagnostics, []);
  const slots = dom!.symbols!.filter((s) => s.kind === "slot");
  assert.equal(slots.length, 3, JSON.stringify(dom!.symbols!.map((s) => [s.id, s.kind])));
  const [mixed, single, passthrough] = slots;
  // Elements + expression: one fragment over the children span (slot rewriting applies inside).
  assert.equal(
    mixed!.source,
    `export const ${mixed!.name} = (n, props) => __rivetSlot(() => (<><p onClick={() => n.update((v) => v + 1)}>{props.label}</p>{n()}</>));\n`,
  );
  assert.deepEqual(mixed!.captures, ["n", "props"]);
  // A single element child keeps the plain form.
  assert.equal(single!.source, `export const ${single!.name} = (props) => __rivetSlot(() => (<b>{props.label}</b>));\n`);
  // A single expression child is the expression.
  assert.equal(passthrough!.source, `export const ${passthrough!.name} = (n) => __rivetSlot(() => (n()));\n`);
  // Server: the thunk is registered as the slot symbol with its captures; the framework Provider gets no symbol.
  for (const s of slots) {
    assert.ok(server!.code.includes(`__rivetR_fn(${JSON.stringify(s.id)}, __rivetSlot(() => `), s.id);
    assert.ok(
      s.imports.some((i) => i.imported === "_slot" && i.from === "@rivetjs/runtime/dom"),
      s.id,
    );
  }
  assert.match(server!.code, /Provider\(\{\s*"token": t,\s*"value": 1,\s*children: __rivetSlot\(\(\) => __rivetTemplate/);
  // Nested sites inside the lazy children (the click handler) and the enclosing region are sites of their own.
  assert.ok(dom!.symbols!.some((s) => s.kind === "event" && s.captures.includes("n")));
  assert.ok(dom!.symbols!.some((s) => s.kind === "region" && s.captures.includes("props")));
  // Symbol ids agree between targets.
  assert.deepEqual(
    server!.symbols!.map((s) => s.id),
    dom!.symbols!.map((s) => s.id),
  );
});

test("resume: `r:slot` groups and function children are unchanged by lazy children", () => {
  const source = `
import { Card } from "./ui.tsx";
export function View(props: { a: string }) {
  return <div>
    <Card><h2 r:slot="header">{props.a}</h2><p>body</p></Card>
    <Card>{() => <p>{props.a}</p>}</Card>
  </div>;
}`;
  const dom = compile(source, { target: "dom", filename: "m.tsx", resume });
  assert.deepEqual(dom.diagnostics, []);
  const slots = dom.symbols!.filter((s) => s.kind === "slot").map((s) => s.source.replace(/^export const \w+\$\w+ = /, ""));
  assert.deepEqual(slots, ["(props) => () => (<h2 >{props.a}</h2>);\n", "() => __rivetSlot(() => (<p>body</p>));\n", "(props) => (() => <p>{props.a}</p>);\n"]);
});

test("resume: a component among a user component's lazy children is its own region (server `_rBind` inside the slot)", () => {
  const source = `import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { List } from "./ui.tsx";
export function P() { const items = signal(["a"]); return <section><List id="l"><For each={items} by={(i) => i}>{(i) => <b>{i()}</b>}</For></List></section>; }`;
  const server = compile(source, { target: "server", filename: "m.tsx", resume });
  assert.deepEqual(server.diagnostics, []);
  assert.deepEqual(
    server.symbols!.map((s) => [s.kind, s.captures]),
    [
      ["region", ["items"]],
      ["region", ["items"]],
      ["slot", ["items"]],
      // `{i()}` reads only the For row getter: a plain cell, no symbol (FLATTEN-CMP-1).
    ],
  );
  const inner = server.symbols!.find((s) => s.kind === "region" && s.source.includes("() => (<For"))!;
  assert.match(
    server.code.replaceAll(/\s+/g, " "),
    new RegExp(`__rivetSlot\\(\\(\\) => __rivetR_bind\\("${inner.id.replaceAll("$", "\\$")}", \\(\\) => For\\(`),
  );
  // DOM target: the same symbol ids, no wrapping (regions re-create through their symbols).
  const dom = compile(source, { target: "dom", filename: "m.tsx", resume });
  assert.deepEqual(
    dom.symbols!.map((s) => s.id),
    server.symbols!.map((s) => s.id),
  );
  assert.doesNotMatch(dom.code, /__rivetR_bind/);
});
