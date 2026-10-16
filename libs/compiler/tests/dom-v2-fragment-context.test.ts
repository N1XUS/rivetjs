// DOM v2: a fragment's dynamic children are read later by the insertion, after `provide(…)` returned
// (`provide(Ctx, v, () => <>…{x() ? <C/> : null}</>)`, cdk Button's ProgressBarContext): `_scoped` runs
// each read in a scope under the fragment's creation owner, so context lookups see the provider, and
// disposes that scope on the next read. Found by the parity harness (tests/v2-parity).
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

test("dynamic fragment children see the providers around the fragment; their scope is disposed per read", async () => {
  const r = compile(
    `
import { createContext, onCleanup, provide, signal, useContext } from "@rivetjs/reactivity";
const Ctx = createContext("outer");
export const on = signal(false);
export const log: string[] = [];
const Leaf = () => { onCleanup(() => log.push("cleanup")); return <i>{useContext(Ctx)}</i>; };
export const A = () => <div>{provide(Ctx, "inner", () => <>x{on() ? <Leaf /> : null}</>)}</div>;`,
    { target: "dom", filename: "m.tsx" },
  );
  assert.deepEqual(r.diagnostics, []);
  // TERNARY-MEMO: the conditional is a condition memo inside the fragment's `_scoped`.
  assert.match(r.code, /_scoped\(__rivet_cond\(\(\) => on\(\), 0, /);
  const window = new Window({ url: "http://localhost/" });
  Object.assign(globalThis, { document: window.document });
  const { A, on, log } = await load(r.code);
  const { mount } = await import(runtime);
  const host = window.document.createElement("div");
  const stop = mount(() => A(), host);
  assert.equal(host.innerHTML, "<div>x</div>");
  on.set(true);
  assert.equal(host.innerHTML, "<div>x<i>inner</i></div>");
  on.set(false);
  assert.equal(host.innerHTML, "<div>x</div>");
  assert.deepEqual(log, ["cleanup"]);
  on.set(true);
  stop();
  assert.deepEqual(log, ["cleanup", "cleanup"]);
});
