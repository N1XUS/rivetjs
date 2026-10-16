// DOM v2 (production client): templates rooted inside SVG content parse in the SVG namespace (B3:
// lexical namespace for expression / component children of `<svg>`, `_tplNs` (flag 8) for a component's
// bare `<a>`), SVG class writes go through the attribute, and unset handler props bind nothing (B1).
import { test } from "vitest";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { compile } from "../index.ts";

const SVG = "http://www.w3.org/2000/svg",
  HTML = "http://www.w3.org/1999/xhtml";
const v2 = (source: string) => compile(source, { target: "dom", filename: "m.tsx" });
const runtime = new URL("../../runtime/dom.ts", import.meta.url).href;
const reactivity = new URL("../../reactivity/index.ts", import.meta.url).href;
const style = new URL("../../runtime/style.ts", import.meta.url).href;
const load = async (code: string) =>
  import(
    "data:text/javascript;base64," +
      Buffer.from(
        code
          .replaceAll('"@rivetjs/runtime/dom"', JSON.stringify(runtime))
          .replaceAll('"@rivetjs/runtime/props"', JSON.stringify(new URL("../../runtime/props.ts", import.meta.url).href))
          .replaceAll('"@rivetjs/reactivity"', JSON.stringify(reactivity))
          .replaceAll('"@rivetjs/runtime/style"', JSON.stringify(style)),
      ).toString("base64")
  );
const setup = () => {
  const window = new Window({ url: "http://localhost/" });
  Object.assign(globalThis, { document: window.document });
  const host = window.document.createElement("div");
  window.document.body.append(host);
  return { window, host };
};

test("B3: JSX in an expression child of <svg> roots its template in SVG", async () => {
  const r = v2(`
import { signal } from "@rivetjs/reactivity";
export const on = signal(false);
export const A = () => <svg><g />{on() && <a href="#x">t</a>}{on() && <a href="#y"><text>u</text></a>}</svg>;
export const B = () => <div>{on() && <a href="#z">h</a>}</div>;`);
  assert.deepEqual(r.diagnostics, []);
  assert.match(r.code, /_tpl\("<a href=#x>t<\/a>", 1\)/);
  const { host } = setup();
  const { A, B, on } = await load(r.code);
  const { mount } = await import(runtime);
  mount(() => [A(), B()], host);
  on.set(true);
  const links = [...host.querySelectorAll("a")];
  assert.deepEqual(
    links.map((a) => [a.getAttribute("href"), a.namespaceURI]),
    [
      ["#x", SVG],
      ["#y", SVG],
      ["#z", HTML],
    ],
  );
});

test("B3: a component's bare <a> (flag 8) takes the insertion parent's namespace, rows included", async () => {
  const r = v2(`
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
export const items = signal(["a"]);
const Link = (p: any) => <a href={p.href} class={p.cls}>{p.label}</a>;
export const A = () => <svg><Link href="#s" cls="k" label="s" /><g><For each={items} by={(x) => x}>{(x) => <Link href={"#" + x()} label={x()} />}</For></g></svg>;
export const B = () => <p><Link href="#h" cls="k" label="h" /></p>;`);
  assert.deepEqual(r.diagnostics, []);
  assert.match(r.code, /_tplNs\("<a> <\/a>"\)/, r.code);
  const { host } = setup();
  const { A, B, items } = await load(r.code);
  const { mount } = await import(runtime);
  mount(() => [A(), B()], host);
  items.set(["a", "b"]);
  const links = [...host.querySelectorAll("a")];
  assert.deepEqual(
    links.map((a) => [a.getAttribute("href"), a.namespaceURI, a.getAttribute("class")]),
    [
      ["#s", SVG, "k"],
      ["#a", SVG, null],
      ["#b", SVG, null],
      ["#h", HTML, "k"],
    ],
  );
});

test("SVG class groups write the attribute (className is read-only on SVG elements)", async () => {
  const r = v2(`
import { signal } from "@rivetjs/reactivity";
export const c = signal("a"), o = signal(true);
export const A = () => <svg><path class={c()} class:on={o()} /></svg>;`);
  assert.deepEqual(r.diagnostics, []);
  assert.doesNotMatch(r.code, /_cls/);
  const { host } = setup();
  const { A, c, o } = await load(r.code);
  const { mount } = await import(runtime);
  mount(() => A(), host);
  const path = host.querySelector("path")!;
  assert.equal(path.getAttribute("class"), "a on");
  o.set(false);
  c.set("");
  assert.equal(path.hasAttribute("class"), false);
});

test("B1: unset handler props (direct and delegated) bind nothing", async () => {
  const r = v2(`export const A = (p: any) => <input onFocus={p.onFocus} onBlur={p.onBlur} onClick={p.onClick} onKeyDown={p.onKeyDown} />;`);
  assert.deepEqual(r.diagnostics, []);
  assert.match(r.code, /_listen/);
  const { window, host } = setup();
  const errors: unknown[] = [];
  window.addEventListener("error", (e) => errors.push((e as unknown as { error: unknown }).error));
  const { A } = await load(r.code);
  const { mount } = await import(runtime);
  let focused = 0;
  mount(() => [A({}), A({ onFocus: () => focused++ })], host);
  const [plain, handled] = [...host.querySelectorAll("input")];
  for (const type of ["focus", "blur"]) plain!.dispatchEvent(new window.FocusEvent(type) as never);
  plain!.dispatchEvent(new window.MouseEvent("click", { bubbles: true }) as never);
  plain!.dispatchEvent(new window.KeyboardEvent("keydown", { bubbles: true }) as never);
  handled!.dispatchEvent(new window.FocusEvent("focus") as never);
  assert.deepEqual(errors, []);
  assert.equal(focused, 1);
  assert.throws(() => mount(() => A({ onFocus: "nope" }), host), /Event handler must be a function/);
});
