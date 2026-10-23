import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compile } from "@rivetjs/compiler";
import { renderToString } from "@rivetjs/runtime/server";
import { importServer } from "./resume/compile.ts";
import { withPage, rewrite } from "./resume/harness.ts";

/** Server build of ./control-flow/fixture.tsx. */
type View = (props: never) => unknown;
interface ServerFixture {
  [component: string]: View;
}
interface UnitModule {
  run(): unknown;
}

const source = await readFile(new URL("./control-flow/fixture.tsx", import.meta.url), "utf8");
const dom = compile(source, { target: "dom", filename: "fixture.tsx" });
const serverCompiled = compile(source, { target: "server", filename: "fixture.tsx" });
const server = await importServer<ServerFixture>(serverCompiled.code);
const html = (component: string, props: Record<string, unknown>): string =>
  renderToString(() => (server[component] as (props: unknown) => never)(props)) as string;

test("compiled control flow compiles cleanly for both targets", () => {
  assert.deepEqual(dom.diagnostics, []);
  assert.deepEqual(serverCompiled.diagnostics, []);
});

test("server: Show / Switch render the active branch only, as the equivalent ternary", () => {
  for (const n of [3, 7]) assert.equal(html("ShowPage", { n: () => n }), html("TernaryPage", { n: () => n }));
  assert.equal(html("ShowPage", { n: () => 7 }), '<div id="show"><button class="a">a:0</button></div>');
  assert.equal(html("ShowPage", { n: () => 1 }), '<div id="show"><i>no</i></div>');
  assert.equal(html("SlotFallbackPage", { n: () => 1 }), "<div><i>slot</i></div>");
  assert.equal(html("SlotFallbackPage", { n: () => 9 }), "<div><b>yes</b></div>");
  assert.equal(html("KeyedPage", { user: () => ({ name: "k<" }) }), '<p><button class="a">k&lt;:0</button></p>');
  assert.equal(html("LivePage", { user: () => null }), "<p>none</p>");
  assert.equal(html("LivePage", { user: () => ({ name: "ann" }) }), "<p><b>ann</b></p>");
  assert.equal(html("EagerPage", { on: () => false }), "<p><i>off</i></p>");
  assert.equal(html("SwitchPage", { n: () => -1 }), '<section><button class="a">neg:0</button></section>');
  assert.equal(html("SwitchPage", { n: () => 20 }), '<section><button class="a">big:0</button></section>');
  assert.equal(html("SwitchPage", { n: () => 5 }), "<section><p>mid</p></section>");
});

test("server: Dynamic renders a component or a safe escaped tag; unsafe tags are rejected", async () => {
  assert.equal(
    html("DynamicPage", { tag: "h2", title: () => 'say "hi"' }),
    '<div><button class="a">dyn:0</button><h2 class="t" title="say &quot;hi&quot;" data-x="1">hello</h2></div>',
  );
  assert.equal(html("SwitchTag", { tag: () => "em" }), "<div><em>x</em></div>");
  for (const tag of ["script", "STYLE", "textarea", "iframe", "a b", "x><y", "1a", ""])
    await assert.rejects(async () => html("Unsafe", { tag }), /Unsafe dynamic tag/, tag);
  assert.equal(html("Unsafe", { tag: "my-el" }), "<my-el></my-el>");
  assert.equal(html("Unsafe", { tag: "br" }), "<br>");
});

test("server: Dynamic tag `style` is a style object (DOM `_spread` parity); a string throws", async () => {
  const { Dynamic } = await import("@rivetjs/runtime/server");
  const tag = (props: Record<string, unknown>) => renderToString(() => Dynamic({ component: "p", ...props } as never)) as string;
  assert.equal(tag({ style: { color: "red", marginTop: 4, "--x": 1 }, id: "a" }), '<p style="color:red;margin-top:4px;--x:1" id="a"></p>');
  assert.equal(tag({ style: () => ({ opacity: 0 }) }), '<p style="opacity:0"></p>');
  await assert.rejects(async () => tag({ style: "color:red" }), /style object/);
});

// DOM: Show / Switch / Match compile to `_show` / `_switch` / `_match` (C3).
test("DOM lowers Show / Switch / Match to `_show` / `_switch` / `_match`", () => {
  assert.deepEqual(dom.diagnostics, []);
  for (const twin of ["_show", "_switch", "_match"]) assert.match(dom.code, new RegExp(`\\b${twin} as `), twin);
  // The public components are not referenced (their import is dropped).
  assert.doesNotMatch(dom.code.replace(/^\/\/.*$/gm, ""), /\b(Show|Switch|Match)\b/);
});

for (const code of [dom.code])
  test(`DOM: Show keeps its subtree, Switch re-creates on index change, Dynamic renders components and tags`, async () => {
    const unit = `
    import { signal, batch } from "/reactivity.mjs";
    import { mount, _c, Dynamic } from "/dom.ts";
    import * as F from "/fixture.mjs";
    const throws = (fn, re) => { try { fn(); } catch (e) { return re.test(e.message) ? true : e.message; } return "no error"; };
    export function run() {
      const out = {};
      const host = document.createElement("div");
      document.body.append(host);
      const view = (C, props) => { host.textContent = ""; return mount(() => _c(C, props), host); };
      const s = F.stats;
      // Show: created once while truthy; state inside survives value changes.
      let n = signal(6);
      s.created = s.disposed = 0;
      let stop = view(F.ShowPage, { n });
      const first = host.querySelector("button");
      first.click();
      for (const v of [7, 8, 9]) n.set(v);
      out.show = { created: s.created, same: host.querySelector("button") === first, text: first.textContent };
      n.set(3);
      out.showOff = { html: host.innerHTML.replace(/<!--[^>]*-->/g, ""), disposed: s.disposed };
      n.set(10);
      out.showOn = { created: s.created, text: host.querySelector("button").textContent };
      stop();
      out.stopped = { disposed: s.disposed, html: host.innerHTML };
      // TERNARY-MEMO: the ternary's test is a memo cut off on its branch — changes that keep n() > 5 true no
      // longer re-create A (before _cond: once per change, 4), like Show.
      n = signal(6);
      s.created = 0;
      stop = view(F.TernaryPage, { n });
      for (const v of [7, 8, 9]) n.set(v);
      out.ternary = s.created;
      stop();
      // r:slot fallback.
      n = signal(1);
      stop = view(F.SlotFallbackPage, { n });
      out.slot = [host.textContent];
      n.set(9);
      out.slot.push(host.textContent);
      stop();
      // keyed: re-created on identity change only.
      const ann = { name: "ann" };
      let user = signal(ann);
      s.created = 0;
      stop = view(F.KeyedPage, { user });
      user.set(ann);
      out.keyed = [s.created, host.textContent];
      user.set({ name: "bob" });
      out.keyed.push(s.created, host.textContent);
      user.set(null);
      out.keyed.push(host.textContent);
      stop();
      // non-keyed: the accessor stays live, the branch is kept.
      user = signal({ name: "ann" });
      stop = view(F.LivePage, { user });
      const b = host.querySelector("b");
      user.set({ name: "cy" });
      out.live = [host.querySelector("b") === b, host.textContent];
      user.set(null);
      out.live.push(host.textContent);
      stop();
      // plain element children are lazy (compiled to a thunk): created when shown, re-created per show.
      const on = signal(false);
      s.created = 0;
      stop = view(F.EagerPage, { on });
      out.eager = [s.created, host.textContent];
      on.set(true);
      const eager = host.querySelector("button");
      eager.click();
      on.set(false);
      on.set(true);
      out.eager.push(s.created, host.querySelector("button") === eager, host.textContent);
      stop();
      // Switch: re-created only when the matched index changes.
      n = signal(1);
      s.created = 0;
      stop = view(F.SwitchPage, { n });
      const trail = [host.textContent];
      n.set(-1); trail.push(host.textContent, s.created);
      const neg = host.querySelector("button");
      n.set(-2); trail.push(s.created, host.querySelector("button") === neg);
      n.set(20); trail.push(host.textContent, s.created);
      n.set(30); trail.push(s.created);
      n.set(5); trail.push(host.textContent);
      out.switch = trail;
      stop();
      // Dynamic: component and tag (validated attributes, accessor attribute, children).
      const title = signal("t1");
      s.created = 0;
      stop = view(F.DynamicPage, { tag: "h2", title });
      const h2 = host.querySelector("h2");
      title.set("t2");
      out.dynamic = [s.created, host.querySelector("button").textContent, h2.className, h2.title, h2.dataset.x, h2.textContent];
      stop();
      const tag = signal("em");
      stop = view(F.SwitchTag, { tag });
      out.tags = [host.querySelector("div").firstElementChild?.localName];
      tag.set("strong");
      out.tags.push(host.querySelector("div").firstElementChild?.localName);
      stop();
      out.unsafe = ["script", "style", "SCRIPT", "x><y", "iframe"].map((t) => throws(() => view(F.Unsafe, { tag: t }), /Unsafe dynamic tag/));
      out.unsafe.push(
        throws(() => view(Dynamic, { component: "img", children: "x" }), /Void element/),
        // An unsafe URL is neutralized, not thrown.
        (() => { const stop = view(Dynamic, { component: "a", href: "javascript:alert(1)" }); const href = host.querySelector("a")?.getAttribute("href"); stop(); return href === "about:invalid#rivet" || href; })(),
        throws(() => view(Dynamic, { component: "a", onclick: "alert(1)" }), /Unsafe attribute name/),
        throws(() => view(Dynamic, { component: "div", innerHTML: "<b>" }), /Unsafe attribute name/),
      );
      let clicked = 0;
      stop = view(Dynamic, { component: "svg", viewBox: "0 0 1 1", onClick: () => clicked++, children: "t" });
      const svg = host.querySelector("svg");
      svg.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      out.svg = [svg.namespaceURI, svg.getAttribute("viewBox"), clicked];
      stop();
      return out;
    }`;
    await withPage({ "/fixture.mjs": rewrite(code), "/unit.mjs": unit, "/": "<!doctype html><body></body>" }, async (page) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("http://rivet.test/");
      const report = await page.evaluate(async () => ((await import("/unit.mjs" as string)) as UnitModule).run());
      assert.deepEqual(report, {
        show: { created: 1, same: true, text: "a:1" },
        showOff: { html: '<div id="show"><i>no</i></div>', disposed: 1 },
        showOn: { created: 2, text: "a:0" },
        stopped: { disposed: 2, html: "" },
        ternary: 1,
        slot: ["slot", "yes"],
        keyed: [1, "ann:0", 2, "bob:0", ""],
        live: [true, "cy", "none"],
        eager: [0, "off", 2, false, "eager:0"],
        switch: ["mid", "neg:0", 1, 1, true, "big:0", 2, 2, "mid"],
        dynamic: [1, "dyn:0", "t", "t2", "1", "hello"],
        tags: ["em", "strong"],
        unsafe: [true, true, true, true, true, true, true, true, true],
        svg: ["http://www.w3.org/2000/svg", "0 0 1 1", 1],
      });
      assert.deepEqual(errors, []);
    });
  });

test("strict authoring types accept Show / Switch / Match / Dynamic", async () => {
  const { default: ts } = await import("typescript");
  const program = ts.createProgram([new URL("./control-flow/fixture.tsx", import.meta.url).pathname], {
    strict: true,
    noEmit: true,
    jsx: ts.JsxEmit.Preserve,
    jsxImportSource: "@rivetjs/runtime",
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target: ts.ScriptTarget.ES2022,
    allowImportingTsExtensions: true,
  });
  assert.deepEqual(
    ts.getPreEmitDiagnostics(program).map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n")),
    [],
  );
});
