// Q1 gap closing (lane G-CMP, 2026-10-06): attribute / content rules that differed between the server
// and the DOM lowerings. Every case runs on both targets: the server output is rendered to a string, the
// DOM (v2) output is mounted in happy-dom.
// - literal `<textarea value>` / `defaultValue` is the content (the client textarea was empty);
// - dynamic `defaultValue` / `defaultChecked` are the default properties (`value` / `checked` content
//   attributes on the server), never bogus `defaultvalue=` attributes;
// - `popover={true|false}` (true → `""` = auto, false → removed), the C4 boolean attributes;
// - `style` numbers get `px` like React (unitless list, `0`, `--custom` as written; C14);
// - `class` + `className` on one element is RV5003 (C15);
// - SMIL `values` URL list is split on `;` only (SEC3);
// - `<template>` with bound content binds into `.content`;
// - C5: statically visible `<For>` / `<Show>` / `.map` directly in `<table>` is RV1005;
// - DOM templates quote values holding Unicode whitespace (`label="\xA0"`).
import { test } from "vitest";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { compile, type CompileOptions } from "../index.ts";
import { renderToString, type ServerValue } from "../../runtime/server.ts";
import { importServer } from "../../runtime/tests/resume/compile.ts";

const runtime = new URL("../../runtime/dom.ts", import.meta.url).href;
const reactivity = import.meta.resolve("@rivetjs/reactivity");
const style = new URL("../../runtime/style.ts", import.meta.url).href;
const window = new Window({ url: "http://localhost/" });
Object.assign(globalThis, { document: window.document, window, MutationObserver: window.MutationObserver });

type Target = "server" | "dom";
const options = (target: Target): CompileOptions => ({ target });
const build = (source: string, target: Target) => compile(source, { filename: "m.tsx", ...options(target) });
const codes = (source: string, target: Target) => build(source, target).diagnostics.map((d) => d.code);
const load = (code: string) =>
  import(
    "data:text/javascript;base64," +
      Buffer.from(
        code
          .replaceAll('"@rivetjs/runtime/dom"', JSON.stringify(runtime))
          .replaceAll('"@rivetjs/runtime/props"', JSON.stringify(new URL("../../runtime/props.ts", import.meta.url).href))
          .replaceAll('"@rivetjs/runtime/style"', JSON.stringify(style))
          .replaceAll('"@rivetjs/reactivity"', JSON.stringify(reactivity)),
      ).toString("base64")
  );
const header = `import { signal } from "@rivetjs/reactivity";\n`;
/** Mount export `name` of `source` on a DOM target; the host element. */
async function mounted(source: string, target: "dom", name = "App") {
  const r = build(header + source, target);
  assert.deepEqual(r.diagnostics, [], source);
  assert.match(r.code, /__rivet_tpl\(/, r.code);
  const mod = await load(r.code);
  const { mount } = await import(runtime);
  const host = window.document.createElement("div");
  window.document.body.append(host);
  mount(() => mod[name](), host);
  return { host: host as unknown as HTMLElement, mod };
}
async function rendered(source: string, name = "App") {
  const r = build(header + source, "server");
  assert.deepEqual(r.diagnostics, [], source);
  const mod = await importServer<Record<string, () => ServerValue>>(r.code);
  return renderToString(mod[name]!);
}
const strip = (html: string) => html.replace(/<!--[^]*?-->/g, "").replace(/ data-rivet-s\d+=""/g, "");
const DOM = ["dom"] as const;

test("literal <textarea value> / defaultValue is the textarea's content on every target", async () => {
  const source = `export const App = () => <div><textarea value="a&amp;b" /><textarea defaultValue={"\\nline"} /><textarea value={"x<y"} /></div>;`;
  assert.equal(await rendered(source), "<div><textarea>\na&amp;b</textarea><textarea>\n\nline</textarea><textarea>\nx&lt;y</textarea></div>");
  for (const target of DOM) {
    const { host } = await mounted(source, target);
    const areas = [...host.querySelectorAll("textarea")];
    assert.deepEqual(
      areas.map((a) => [a.value, a.defaultValue, a.hasAttribute("value")]),
      [
        ["a&b", "a&b", false],
        ["\nline", "\nline", false],
        ["x<y", "x<y", false],
      ],
      target,
    );
  }
  // One source of content: value + children is the server's diagnostic on every target.
  for (const target of ["server", "dom"] as const)
    assert.deepEqual(codes(`export const A = () => <textarea value="a">b</textarea>;`, target), ["RV1009"], target);
});

test("dynamic defaultValue / defaultChecked write the defaults (server: value / checked attributes)", async () => {
  const source = `export const text = signal("t1"), on = signal(true);
export const App = () => <form><input defaultValue={text()} /><input type="checkbox" defaultChecked={on()} /><textarea defaultValue={text()} /><div defaultValue={text()} /></form>;`;
  assert.equal(await rendered(source), '<form><input value="t1"><input type="checkbox" checked><textarea>\nt1</textarea><div value="t1"></div></form>');
  for (const target of ["dom"] as const) {
    const { host, mod } = await mounted(source, target);
    const [text, box] = [...host.querySelectorAll("input")] as HTMLInputElement[];
    const area = host.querySelector("textarea")!;
    const read = () => [
      text!.getAttribute("value"),
      text!.value,
      box!.hasAttribute("checked"),
      box!.checked,
      area.value,
      host.querySelector("div")!.getAttribute("value"),
    ];
    assert.equal(host.innerHTML.includes("defaultvalue"), false, target);
    assert.deepEqual(read(), ["t1", "t1", true, true, "t1", "t1"], target);
    // A user edit makes the control dirty: a new default changes the attribute, not the edited value.
    text!.value = "typed";
    mod.text.set("t2");
    mod.on.set(false);
    assert.deepEqual(read(), ["t2", "typed", false, false, "t2", "t2"], target);
  }
});

test("popover={true|false} and the C4 boolean attributes on every target", async () => {
  const source = `export const on = signal(true);
export const App = () => <div><p popover={on()} /><p popover={!on()} /><p popover="manual" /><video disablePictureInPicture={!on()} disableRemotePlayback={on()} /></div>;`;
  assert.equal(await rendered(source), '<div><p popover></p><p></p><p popover="manual"></p><video disableremoteplayback></video></div>');
  for (const target of ["dom"] as const) {
    const { host, mod } = await mounted(source, target);
    const [a, b, c] = [...host.querySelectorAll("p")];
    const video = host.querySelector("video")!;
    const read = () => [
      a!.getAttribute("popover"),
      b!.getAttribute("popover"),
      c!.getAttribute("popover"),
      video.getAttribute("disablepictureinpicture"),
      video.getAttribute("disableremoteplayback"),
    ];
    assert.deepEqual(read(), ["", null, "manual", null, ""], target);
    mod.on.set(false);
    assert.deepEqual(read(), [null, "", "manual", "", null], target);
  }
});

test("style numbers get px outside the unitless list (0, --custom and unitless properties as written)", async () => {
  const source = `export const n = signal(4);
export const App = () => <p style={{ width: 10, zIndex: 2, lineHeight: 1.5, marginTop: 0, "--x": 3, WebkitLineClamp: 2, height: n() }} />;`;
  const expected = "width:10px;z-index:2;line-height:1.5;margin-top:0;--x:3;-webkit-line-clamp:2;height:4px";
  assert.equal(await rendered(source), `<p style="${expected}"></p>`);
  for (const target of ["dom"] as const) {
    const { host, mod } = await mounted(source, target);
    const p = host.querySelector("p")!;
    assert.equal(p.style.getPropertyValue("width"), "10px", target);
    assert.equal(p.style.getPropertyValue("z-index"), "2", target);
    assert.equal(p.style.getPropertyValue("height"), "4px", target);
    mod.n.set(7);
    assert.equal(p.style.getPropertyValue("height"), "7px", target);
  }
  // `style:` directives fold the same way.
  assert.equal(await rendered(`export const App = () => <p style:width={5} style:opacity={0.5} />;`), '<p style="width:5px;opacity:0.5"></p>');
});

test('a dynamic empty class removes the attribute on the DOM target (no write for a fresh row); static class="" stays', async () => {
  const source = `export const c = signal("");
export const App = () => <div><p class={c()} /><p class="" /><p {...{ class: c() }} /></div>;`;
  for (const target of ["dom"] as const) {
    const { host, mod } = await mounted(source, target);
    const read = () => [...host.querySelectorAll("p")].map((p) => p.getAttribute("class"));
    assert.deepEqual(read(), [null, "", null], target);
    mod.c.set("a");
    assert.deepEqual(read(), ["a", "", "a"], target);
    mod.c.set("");
    assert.deepEqual(read(), [null, "", null], target);
  }
});

test("class + className on one element is RV5003 on every target (C15)", () => {
  for (const body of [`<p class="a" className={p.b} />`, `<p className="a" class="b" />`])
    for (const target of ["server", "dom"] as const) assert.deepEqual(codes(`export const A = (p) => ${body};`, target), ["RV5003"], `${target} ${body}`);
  // Spread elements merge both into the object (later key wins on every target): no diagnostic.
  assert.deepEqual(codes(`export const A = (p) => <p {...p} class="a" className="b" />;`, "server"), []);
});

test("SMIL values: entries split on `;` only, so tabs / spaces inside a URL cannot hide a scheme (SEC3)", () => {
  for (const target of ["server", "dom"] as const) {
    assert.deepEqual(
      codes(`export const A = () => <svg><animate attributeName="href" values=" JaVa\tScRiPt:alert(1);/ok" /></svg>;`, target),
      ["RV1101"],
      target,
    );
    assert.deepEqual(codes(`export const A = () => <svg><animate attributeName="href" values="/a; /b c" /></svg>;`, target), [], target);
  }
});

test("DOM templates keep quotes around values holding Unicode whitespace", () => {
  const code = build(`export const A = () => <select><option label={"\\u00a0"} value="" /></select>;`, "dom").code;
  assert.match(code, /label=\\"\\xA0\\"/, code);
});

test("<template> with bound content binds into .content on the DOM target; the server renders it inline", async () => {
  const source = `export const t = signal("a");
export const App = () => <template data-x=""><b class={t()}>{t()}</b>!</template>;`;
  assert.equal(await rendered(source), '<template data-x=""><b class="a">a</b>!</template>');
  for (const target of DOM) {
    const { host, mod } = await mounted(source, target);
    const template = host.querySelector("template")!;
    assert.equal(template.childNodes.length, 0, target);
    assert.equal(strip(template.innerHTML), '<b class="a">a</b>!', target);
    mod.t.set("b");
    assert.equal(strip(template.innerHTML), '<b class="b">b</b>!', target);
  }
});

test("C5: For / Show / .map directly in <table> is RV1005 on every target; components and {children} stay legal", () => {
  const header = `import { For, Show } from "@rivetjs/runtime/dom";\n`;
  for (const body of [
    `<table><For each={p.rows}>{(r) => <tr />}</For></table>`,
    `<table><Show when={p.x}><tr /></Show></table>`,
    `<table>{p.rows.map((r) => <tr />)}</table>`,
    `<table>{p.rows?.map((r) => <tr />)}</table>`,
  ])
    for (const target of ["server", "dom"] as const) {
      const r = build(header + `export const A = (p) => ${body};`, target);
      assert.deepEqual(
        r.diagnostics.map((d) => d.code),
        ["RV1005"],
        `${target} ${body}`,
      );
    }
  for (const body of [
    `<table><Rows />{p.children}<tbody>{p.rows.map((r) => <tr />)}</tbody></table>`,
    `<table><thead><For each={p.rows}>{(r) => <tr />}</For></thead></table>`,
  ])
    for (const target of ["server", "dom"] as const)
      assert.deepEqual(codes(header + `const Rows = () => null;\nexport const A = (p) => ${body};`, target), [], `${target} ${body}`);
});
