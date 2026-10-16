// DOM v2 (production client) coverage of form controls (C4 static ones; bound ones: dom-v2-gaps.test.ts),
// resume preload directives (C4), and
// live structural props (RV1014 retired, LIVE-PROPS).
import { test } from "vitest";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { check, compile } from "../index.ts";

const v2 = (source: string) => compile(source, { target: "dom", filename: "m.tsx" });
const runtime = new URL("../../runtime/dom.ts", import.meta.url).href;
const load = async (code: string) =>
  import(
    "data:text/javascript;base64," +
      Buffer.from(
        code
          .replaceAll('"@rivetjs/runtime/dom"', JSON.stringify(runtime))
          .replaceAll('"@rivetjs/runtime/props"', JSON.stringify(new URL("../../runtime/props.ts", import.meta.url).href)),
      ).toString("base64")
  );

test("static select / option / optgroup / textarea lower through v2", async () => {
  const r = v2(
    `export const A = (p: any) => <form><select name="s" onChange={p.f}><option value="a">A</option><optgroup label="g"><option value="b" selected>{p.b}</option></optgroup></select><textarea name="t">hi there</textarea></form>;`,
  );
  assert.deepEqual(r.diagnostics, []);
  assert.match(r.code, /__rivet_tpl\(/);
  assert.ok(
    r.code.includes(
      String.raw`__rivet_tpl("<form><select name=s><option value=a>A</option><optgroup label=g><option value=b selected> </option></optgroup></select><textarea name=t>hi there</textarea>")`,
    ),
    r.code,
  );
  const window = new Window({ url: "http://localhost/" });
  Object.assign(globalThis, { document: window.document });
  const { A } = await load(r.code);
  const { mount } = await import(runtime);
  let changes = 0;
  const host = window.document.createElement("div");
  window.document.body.append(host);
  mount(() => A({ f: () => changes++, b: "B" }), host);
  const form = host.querySelector("form")!;
  const select = form.querySelector("select")!;
  assert.equal(select.value, "b");
  assert.equal(select.options[1]!.textContent, "B");
  assert.equal(form.querySelector("textarea")!.value, "hi there");
  select.dispatchEvent(new window.Event("change") as never);
  assert.equal(changes, 1);
});

// Phase b (mounted behaviour: dom-v2-gaps.test.ts): former v1-only trees lower through v2.
test("select value, inserted options, dynamic / leading-newline textarea text, spreads and lone options lower through v2", () => {
  for (const source of [
    `export const A = (p: any) => <select value={p.v}><option value="a">A</option></select>;`,
    `export const A = (p: any) => <select>{p.items.map((i: any) => <option>{i}</option>)}</select>;`,
    `export const A = (p: any) => <textarea>{p.v}</textarea>;`,
    `export const A = (p: any) => <textarea value={p.v} />;`,
    `export const A = () => <textarea>{"\\nx"}</textarea>;`,
    `export const A = (p: any) => <select {...p}><option>1</option></select>;`,
    `export const A = () => <option>alone</option>;`,
  ]) {
    const r = v2(source);
    assert.deepEqual(r.diagnostics, [], source);
    assert.doesNotMatch(r.code, /__rivetSpec0/, source);
    assert.match(r.code, /__rivet_tpl/, source);
  }
});

test("preload directives validate (RV1102) and render nothing in v2", () => {
  const r = v2(`export const A = (p: any) => <button preload="idle" onClick={p.f}>x</button>;`);
  assert.deepEqual(r.diagnostics, []);
  assert.ok(r.code.includes('__rivet_tpl("<button>x")'), r.code);
  // <video preload> stays the native attribute.
  assert.ok(v2(`export const A = () => <video preload="none" />;`).code.includes("<video preload=none>"));
  assert.deepEqual(
    v2(`export const A = (p: any) => <button preload="soon" onClick={p.f}>x</button>;`).diagnostics.map((d) => d.code),
    ["RV1102"],
  );
});

const header = `import { For, Show, Switch, Match } from "@rivetjs/runtime/dom";\ndeclare const items: () => number[], on: () => boolean, memo: (f: () => boolean) => () => boolean;\n`;

test("live props (RV1014 retired): <For each={xs()}> / <Show when={on()}> / <Match when={on()}> are getters", () => {
  const out = (body: string) => v2(header + `export const A = () => ${body};`);
  for (const body of [
    `<ul><For each={items()} by={(x) => x}>{(x) => <li>{x()}</li>}</For></ul>`,
    `<Show when={on()}>x</Show>`,
    `<Switch><Match when={(on())}>x</Match></Switch>`,
    `<ul><For each={items} by={(x) => x}>{(x) => <li>{x()}</li>}</For></ul>`,
    `<Show when={() => on()}>x</Show>`,
  ])
    assert.deepEqual(out(body).diagnostics, [], body);
  assert.match(out(`<ul><For each={items()} by={(x) => x}>{(x) => <li>{x()}</li>}</For></ul>`).code, /_for\(__rivetProps\d+\(\(\) => items\(\), \(x\) => x, /);
  assert.match(out(`<Show when={on()}>x</Show>`).code, /__rivetPropsGetter\(o, "when", 0\);[\s\S]*_c\(__rivet_show, __rivetProps\d+\(\(\) => on\(\)\)\)/);
  // Accessors stay plain values (the runtime reads `when` / `each` as value or accessor).
  assert.match(out(`<ul><For each={items} by={(x) => x}>{(x) => <li>{x()}</li>}</For></ul>`).code, /_for\(\{\s*"?each"?: items,/);
  const checked = check(header + `export const A = () => <Show when={on()}>x</Show>;`, { filename: "m.tsx" });
  assert.deepEqual(checked.diagnostics, []);
});
