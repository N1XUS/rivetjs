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

// COLD-FIX-B (2026-10-27): a ternary with JSX on both sides among a component's lazy children is a condition memo
// (`_scoped(_cond(…))`) like the "maybe nothing" forms: inline in the slot thunk, its branch switch re-ran the whole slot
// where the component inserts it and rebuilt every sibling (ui DateField: the focused segment, under a FieldError /
// Description switch). The server output is unchanged (plain value).
test("DOM: a both-JSX ternary among lazy children is a `_cond` accessor; its siblings keep their nodes", async () => {
  const source = `import { signal } from "@rivetjs/reactivity";
export const on = signal(false);
const Box = (props: { children?: unknown }) => <div>{props.children as never}</div>;
export const A = () => <Box><input id="kept" />{on() ? <b>on</b> : <i>off</i>}</Box>;`;
  const r = compile(source, { target: "dom", filename: "m.tsx" });
  assert.deepEqual(r.diagnostics, []);
  assert.match(r.code, /__rivetSlot\(\(\) => \[[^\]]*_scoped\(__rivet_cond\(\(\) => on\(\), 0, /);
  const server = compile(source, { target: "server", filename: "m.tsx" });
  assert.deepEqual(server.diagnostics, []);
  assert.doesNotMatch(server.code, /_cond/);
  const { Window } = await import("happy-dom");
  const runtime = new URL("../../runtime/dom.ts", import.meta.url).href;
  const reactivity = new URL("../../reactivity/index.ts", import.meta.url).href;
  const code = r.code
    .replaceAll('"@rivetjs/runtime/dom"', JSON.stringify(runtime))
    .replaceAll('"@rivetjs/runtime/props"', JSON.stringify(new URL("../../runtime/props.ts", import.meta.url).href))
    .replaceAll('"@rivetjs/reactivity"', JSON.stringify(reactivity));
  const window = new Window({ url: "http://localhost/" });
  Object.assign(globalThis, { document: window.document });
  const { A, on } = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
  const { mount } = await import(runtime);
  const host = window.document.createElement("div");
  const stop = mount(() => A(), host);
  const kept = host.querySelector("#kept");
  assert.equal(host.querySelector("i")?.textContent, "off");
  on.set(true);
  assert.equal(host.querySelector("b")?.textContent, "on");
  assert.equal(host.querySelector("#kept"), kept, "the sibling input is the same node");
  stop();
});
