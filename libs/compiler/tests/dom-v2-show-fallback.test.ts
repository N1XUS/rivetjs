// A `Show` / `Switch` / `For` / ternary given as a branch's JSX is reactive control flow: its accessor must not be taken for a
// render function, which runs once, untracked. Same for live props of a component in `fallback`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { compile } from "../index.ts";

const runtime = new URL("../../runtime/dom.ts", import.meta.url).href;
const reactivity = new URL("../../reactivity/index.ts", import.meta.url).href;
const load = async (code: string) =>
  import(
    "data:text/javascript;base64," +
      Buffer.from(
        code
          .replaceAll('"@rivetjs/runtime/dom"', JSON.stringify(runtime))
          .replaceAll('"@rivetjs/runtime/props"', JSON.stringify(new URL("../../runtime/props.ts", import.meta.url).href))
          .replaceAll('"@rivetjs/reactivity"', JSON.stringify(reactivity)),
      ).toString("base64")
  );

const run = async (source: string) => {
  const r = compile(source, { target: "dom", filename: "m.tsx" });
  assert.deepEqual(r.diagnostics, []);
  const window = new Window({ url: "http://localhost/" });
  Object.assign(globalThis, { document: window.document });
  const module = await load(r.code);
  const { mount } = await import(runtime);
  const host = window.document.createElement("div");
  return { module, host, stop: mount(() => module.A(), host) as () => void };
};

test("a Show in another Show's fallback follows its own when", async () => {
  const { module, host, stop } = await run(`
import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
export const a = signal(false);
export const b = signal(false);
export const A = () => <div><Show when={a()} fallback={<Show when={b()} fallback={<i>none</i>}><b>inner</b></Show>}><u>outer</u></Show></div>;`);
  assert.equal(host.innerHTML.replace(/<!--.*?-->/g, ""), "<div><i>none</i></div>");
  module.b.set(true);
  assert.equal(host.innerHTML.replace(/<!--.*?-->/g, ""), "<div><b>inner</b></div>");
  module.b.set(false);
  assert.equal(host.innerHTML.replace(/<!--.*?-->/g, ""), "<div><i>none</i></div>");
  module.a.set(true);
  assert.equal(host.innerHTML.replace(/<!--.*?-->/g, ""), "<div><u>outer</u></div>");
  module.a.set(false);
  module.b.set(true);
  assert.equal(host.innerHTML.replace(/<!--.*?-->/g, ""), "<div><b>inner</b></div>");
  stop();
});

test("a Switch, a For and a ternary in a fallback stay reactive", async () => {
  const { module, host, stop } = await run(`
import { signal } from "@rivetjs/reactivity";
import { For, Match, Show, Switch } from "@rivetjs/runtime/dom";
export const c = signal(false);
export const list = signal(["x"]);
export const A = () => (
  <div>
    <Show when={false} fallback={<Switch fallback={<i>no</i>}><Match when={c()}><b>yes</b></Match></Switch>}><u /></Show>
    <Show when={false} fallback={<For each={list()} by={(v) => v}>{(v) => <em>{v()}</em>}</For>}><u /></Show>
    <Show when={false} fallback={c() ? <s>on</s> : <q>off</q>}><u /></Show>
  </div>
);`);
  const text = () => host.innerHTML.replace(/<!--.*?-->/g, "").replace(/\s+/g, "");
  assert.equal(text(), "<div><i>no</i><em>x</em><q>off</q></div>");
  module.c.set(true);
  module.list.set(["x", "y"]);
  assert.equal(text(), "<div><b>yes</b><em>x</em><em>y</em><s>on</s></div>");
  stop();
});

test("live props of a component in a fallback update", async () => {
  const { module, host, stop } = await run(`
import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
export const label = signal("one");
const Leaf = (props: { text: string }) => <i>{props.text}</i>;
export const A = () => <div><Show when={false} fallback={<Leaf text={label()} />}><u /></Show></div>;`);
  assert.equal(host.innerHTML.replace(/<!--.*?-->/g, ""), "<div><i>one</i></div>");
  module.label.set("two");
  assert.equal(host.innerHTML.replace(/<!--.*?-->/g, ""), "<div><i>two</i></div>");
  stop();
});
