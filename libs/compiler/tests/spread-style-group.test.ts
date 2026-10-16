// MATRIX-1 (user ruling 2026-10-06, `rust/src/compile.rs` `spread_style`): on a spread element the
// `style` group (`style:prop` directives, with or without a `style={obj}` next to them) joins the
// spread object as ONE `style` object at the group's first attribute — source order, later keys win,
// like any other spread key. Before: the server rendered two `style` attributes when the spread
// carried one, and the DOM target let the spread's `style` (applied last) wipe the directives.
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
const build = (source: string, target: Target, extra: Partial<CompileOptions> = {}) => {
  const r = compile(source, { filename: "m.tsx", ...options(target), ...extra });
  assert.deepEqual(r.diagnostics, [], source);
  return r.code;
};
const squash = (code: string) => code.replace(/\s+/g, " ");
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

const SOURCE = `import { signal } from "@rivetjs/reactivity";
export const bag = signal<Record<string, unknown>>({ id: "a", style: { color: "red", top: "1px" } });
export const t = signal("scale(2)");
export const App = () => <div {...bag()} style={{ left: "2px" }} style:transform={t()} style:color="blue">x</div>;
export const Before = () => <div style:transform={t()} {...bag()}>y</div>;`;

test("spread + style group: one style object in the spread object (server, resume, dom)", () => {
  const object = /"style": \{ "left": "2px", "transform": t\(\), "color": "blue" \}/;
  for (const target of ["server", "dom"] as const) {
    const code = squash(build(SOURCE, target));
    assert.match(code, object, target);
    assert.doesNotMatch(code, /StyleAttr|BindStyle|R_styled/, target);
  }
  const resumed = squash(build(SOURCE, "server", { resume: { module: "m" } }));
  assert.match(resumed, /__rivetR_spread\("m#App\$\w+", \(\) => \(\{ \.\.\.bag\(\), "style": \{ "left": "2px", "transform": t\(\), "color": "blue" \} \}\)/);
  assert.doesNotMatch(resumed, /StyleAttr|R_styled/);
  // The resume symbol re-binds the same object in the browser (no separate styled site).
  const symbols = compile(SOURCE, { target: "dom", filename: "m.tsx", resume: { module: "m" } }).symbols!;
  assert.deepEqual(
    symbols.map((s) => s.kind),
    ["spread", "spread"],
  );
  assert.match(squash(symbols[0]!.source), /"style": \{ "left": "2px", "transform": \(t\(\)\), "color": "blue" \}/);
});

test("spread + style group renders ONE style attribute; the later source position wins", async () => {
  const mod = await importServer<Record<string, () => ServerValue>>(build(SOURCE, "server"));
  // Group after the spread: replaces the spread's style.
  assert.equal(await renderToString(mod.App!), `<div id="a" style="left:2px;transform:scale(2);color:blue">x</div>`);
  // Group before the spread: the spread's style wins (as for any key).
  assert.equal(await renderToString(mod.Before!), `<div style="color:red;top:1px" id="a">y</div>`);
});

test("spread + style group (dom): the directives survive spread updates and update themselves", async () => {
  const mod = await load(build(SOURCE, "dom"));
  const { mount } = await import(runtime);
  const host = window.document.createElement("div");
  window.document.body.append(host);
  mount(() => [mod.App(), mod.Before()], host);
  const [app, before] = [...host.children] as unknown as HTMLElement[];
  assert.equal(app!.style.transform, "scale(2)");
  assert.equal(app!.style.color, "blue");
  assert.equal(app!.style.left, "2px");
  assert.equal(app!.style.top, "");
  assert.equal(before!.style.color, "red");
  mod.bag.set({ id: "b", style: { color: "green" } });
  assert.equal(app!.id, "b");
  assert.equal(app!.style.transform, "scale(2)");
  assert.equal(app!.style.color, "blue");
  assert.equal(before!.style.color, "green");
  mod.t.set("none");
  assert.equal(app!.style.transform, "none");
  host.remove();
});
