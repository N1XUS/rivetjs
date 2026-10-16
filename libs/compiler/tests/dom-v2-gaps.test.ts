// DOM v2 phase b (docs/design/specs/2026-10-06-dom-v2-only-design.md): trees that used to fall back to v1
// lower through v2 (the only DOM target since v1 was deleted) — `<select value>` / inserted options, `model:`,
// dynamic / leading-newline `<textarea>` and `<title>` (RCDATA), `prop:`, `window:` / `document:` events,
// `r:slot`, static `<template>`, SVG `<title>`, MathML, `foreignObject` — and B2: the HTML parser repair rule
// (`html.rs` `parser_repaired`) gates the client build like the server, so client-only builds report RV1005
// too. Each feature mounts the v2 output in happy-dom and pins the DOM / properties / signal writes the
// former v1 path produced.
import { test } from "vitest";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { check, compile } from "../index.ts";

const runtime = new URL("../../runtime/dom.ts", import.meta.url).href;
// The specifier the runtime itself resolves (same conditions → one reactivity instance).
const reactivity = import.meta.resolve("@rivetjs/reactivity");
const window = new Window({ url: "http://localhost/" });
Object.assign(globalThis, {
  document: window.document,
  window,
  MutationObserver: window.MutationObserver,
  // `window:` events target `globalThis` (the browser window): forward to happy-dom's.
  addEventListener: window.addEventListener.bind(window),
  removeEventListener: window.removeEventListener.bind(window),
});

const build = (source: string) => compile(source, { target: "dom", filename: "m.tsx" });
const load = (code: string) =>
  import(
    "data:text/javascript;base64," +
      Buffer.from(
        code
          .replaceAll('"@rivetjs/runtime/dom"', JSON.stringify(runtime))
          .replaceAll('"@rivetjs/runtime/props"', JSON.stringify(new URL("../../runtime/props.ts", import.meta.url).href))
          .replaceAll('"@rivetjs/reactivity"', JSON.stringify(reactivity)),
      ).toString("base64")
  );
const header = `import { signal } from "@rivetjs/reactivity";\nimport { For } from "@rivetjs/runtime/dom";\n`;
/** DOM output is a v2 template tree. */
const v2Only = (code: string) => assert.match(code, /__rivet_tpl\(/, code);
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
/** Strip v2 markers: the rendered content. */
const html = (el: Element) => el.innerHTML.replace(/<!--[^]*?-->/g, "");

/** Compile `source`, mount `App` and run `scenario` against it. */
async function mounted(source: string, scenario: (host: Element, mod: Record<string, any>, flush: () => Promise<void>) => Promise<unknown> | unknown) {
  const r = build(header + source);
  assert.deepEqual(r.diagnostics, [], source);
  v2Only(r.code);
  const mod = await load(r.code);
  const { mount } = await import(runtime);
  const host = window.document.createElement("div");
  window.document.body.append(host);
  const dispose = mount(() => mod.App(), host);
  try {
    return await scenario(host as unknown as Element, mod, tick);
  } finally {
    dispose();
    host.remove();
  }
}

test("B2: parser-repaired nesting reports RV1005 on the DOM build and the server; legal nesting stays v2", () => {
  for (const body of [
    `<p><nav>x</nav></p>`,
    `<ul><li>a<li>b</li></li></ul>`,
    `<a href="/a"><a href="/b">x</a></a>`,
    `<p><div>x</div></p>`,
    `<form><form /></form>`,
  ]) {
    const source = `export const A = () => ${body};`;
    for (const options of [{ target: "dom" }, { target: "server" }] as const) {
      const r = compile(source, { filename: "m.tsx", ...options });
      assert.deepEqual(
        r.diagnostics.map((d) => d.code),
        ["RV1005"],
        `${body} ${JSON.stringify(options)}`,
      );
    }
    assert.ok(
      check(source, { filename: "m.tsx" }).diagnostics.some((d) => d.code === "RV1005"),
      body,
    );
  }
  // The old v2-only rule made these fall back; the parser keeps them as written.
  for (const body of [
    `<p><button><div>x</div></button></p>`,
    `<table><tbody><tr><td><table><tbody><tr><td>x</td></tr></tbody></table></td></tr></tbody></table>`,
  ]) {
    const r = build(`export const A = () => ${body};`);
    assert.deepEqual(r.diagnostics, [], body);
    v2Only(r.code);
  }
});

test("select value applies after inserted options and re-applies when options change", async () => {
  const out = await mounted(
    `export const items = signal(["a", "b", "c"]); export const v = signal("b");
     export const App = () => <select value={v()}><option value="">-</option><For each={items} by={(x) => x}>{(x) => <option value={x()}>{x()}</option>}</For></select>;`,
    async (host, { items, v }, flush) => {
      const select = host.querySelector("select")!;
      const seen: unknown[] = [select.value];
      v.set("c");
      seen.push(select.value);
      items.set(["a", "b", "c", "d"]);
      v.set("d");
      await flush();
      seen.push(select.value, select.options.length);
      return [seen, html(host)];
    },
  );
  assert.deepEqual(out, [
    ["b", "c", "d", 5],
    '<select><option value="">-</option><option value="a">a</option><option value="b">b</option><option value="c">c</option><option value="d">d</option></select>',
  ]);
});

test("select model:value writes back; multiple selects arrays; literal value", async () => {
  const writeBack = await mounted(
    `export const s = signal("y");
     export const App = () => <select model:value={s}><option value="x">X</option><option value="y">Y</option></select>;`,
    (host, { s }) => {
      const select = host.querySelector("select")!;
      const seen = [select.value];
      select.value = "x";
      select.dispatchEvent(new window.Event("input", { bubbles: true }) as never);
      seen.push(s());
      return seen;
    },
  );
  assert.deepEqual(writeBack, ["y", "x"]);
  const multiple = await mounted(
    `export const App = () => <select multiple value={["a", "c"]}>{["a", "b", "c"].map((x) => <option value={x}>{x}</option>)}</select>;`,
    (host) => [...host.querySelector("select")!.selectedOptions].map((o) => o.value),
  );
  assert.deepEqual(multiple, ["a", "c"]);
  const literal = await mounted(
    `export const App = () => <select value="b"><option value="a">A</option><option value="b">B</option></select>;`,
    (host) => host.querySelector("select")!.value,
  );
  assert.equal(literal, "b");
});

test("model:value on inputs / textarea and model:checked (IME composition)", async () => {
  const out = await mounted(
    `export const text = signal("hi"); export const on = signal(true); export const area = signal("a");
     export const App = () => <div><input model:value={text} /><input type="checkbox" model:checked={on} /><textarea model:value={area} /></div>;`,
    (host, { text, on, area }) => {
      const [input, box] = host.querySelectorAll("input");
      const textarea = host.querySelector("textarea")!;
      const seen: unknown[] = [input!.value, box!.checked, textarea.value];
      input!.value = "typed";
      input!.dispatchEvent(new window.Event("input", { bubbles: true }) as never);
      input!.dispatchEvent(new window.Event("compositionstart") as never);
      input!.value = "ime";
      input!.dispatchEvent(new window.Event("input", { bubbles: true }) as never);
      seen.push(text());
      input!.dispatchEvent(new window.Event("compositionend") as never);
      seen.push(text());
      box!.checked = false;
      box!.dispatchEvent(new window.Event("change", { bubbles: true }) as never);
      area.set("set");
      seen.push(on(), textarea.value);
      return seen;
    },
  );
  // Composition holds the write until compositionend.
  assert.deepEqual(out, ["hi", true, "a", "typed", "ime", false, "set"]);
});

test("dynamic and leading-newline textarea / title content", async () => {
  const out = await mounted(
    `export const n = signal(1);
     export const App = () => <div><textarea name="t">count {n()} items</textarea><textarea>{"\\nfirst"}</textarea><title>T{n()}</title></div>;`,
    (host, { n }) => {
      const [a, b] = host.querySelectorAll("textarea");
      const seen = [a!.value, b!.value, host.querySelector("title")!.textContent];
      n.set(2);
      seen.push(a!.value, host.querySelector("title")!.textContent);
      return seen;
    },
  );
  assert.deepEqual(out, ["count 1 items", "\nfirst", "T1", "count 2 items", "T2"]);
  // Non-scalar parts throw.
  const r = build(header + `export const App = () => <textarea>{document.createElement("b")}</textarea>;`);
  const mod = await load(r.code);
  const { mount } = await import(runtime);
  assert.throws(() => mount(() => mod.App(), window.document.createElement("div")), /must be scalar text/);
});

test("prop: sets the element property (reactive when the value can read state)", async () => {
  const out = await mounted(
    `export const on = signal(true); const fixed = "x";
     export const App = () => <div><input type="checkbox" prop:indeterminate={on()} /><input prop:title={fixed} /></div>;`,
    (host, { on }) => {
      const [box, text] = host.querySelectorAll("input");
      const seen = [(box as HTMLInputElement).indeterminate, (text as HTMLInputElement).title];
      on.set(false);
      seen.push((box as HTMLInputElement).indeterminate);
      return seen;
    },
  );
  assert.deepEqual(out, [true, "x", false]);
  assert.match(
    build(`export const A = (p: any) => <input prop:indeterminate={p.on} />;`).code,
    /__rivet_fx\(\(\) => __rivet_setProp\(_el\$\d+, "indeterminate", p\.on\)\)/,
  );
});

test("window: / document: events attach owned clientEvent listeners", async () => {
  const out = await mounted(
    `export const log: string[] = [];
     export const App = () => <span hidden window:onResize={() => log.push("w")} document:onScroll={() => log.push("d")}></span>;`,
    (_host, { log }) => {
      window.dispatchEvent(new window.Event("resize") as never);
      window.document.dispatchEvent(new window.Event("scroll") as never);
      return log.splice(0);
    },
  );
  assert.deepEqual(out, ["w", "d"]);
});

test("static <template> content, SVG <title>, MathML and foreignObject lower through v2", async () => {
  const out = await mounted(
    `export const t = signal("tip"); export const id = signal("a");
     export const App = () => <div>
       <template data-id={id()}><p class="x">static <b>content</b></p></template>
       <svg viewBox="0 0 2 2"><title>{t()}</title><foreignObject width="2" height="2"><div class={t()}>html</div></foreignObject></svg>
       <math><mrow><mi>{t()}</mi><mo>+</mo></mrow></math>
     </div>;`,
    (host, { t, id }) => {
      const template = host.querySelector("template")!;
      const title = host.querySelector("title")!;
      const div = host.querySelector("foreignObject div")!;
      const mi = host.querySelector("mi")!;
      // The foreignObject div / MathML namespaces are not pinned: happy-dom parses their content loosely (Chromium: compiler-dom fixture).
      const seen = [template.content.textContent, title.namespaceURI, div.namespaceURI, mi.namespaceURI, mi.textContent];
      t.set("next");
      id.set("b");
      seen.push(title.textContent, div.className, mi.textContent, template.getAttribute("data-id"));
      return seen;
    },
  );
  assert.deepEqual(
    [(out as unknown[])[0], (out as unknown[])[1], ...(out as unknown[]).slice(4)],
    ["static content", "http://www.w3.org/2000/svg", "tip", "next", "next", "next", "b"],
  );

  // Bindings inside <template> content lower through v2 too: inserted into `.content` (gap-cmp.test.ts).
  assert.match(build(`export const A = (p: any) => <template><p>{p.x}</p></template>;`).code, /_insert\(_el\$1\.content, /);
});

test("r:slot content and a conditional SVG <title> root lower through v2", async () => {
  const card = `const Card = (p: any) => <section>{p.header?.()}<div>{p.children}</div></section>;\n`;
  assert.equal(
    await mounted(card + `export const App = () => <Card><h2 r:slot="header">Head</h2><p>body</p></Card>;`, (host) => html(host)),
    "<section><h2>Head</h2><div><p>body</p></div></section>",
  );
  const svgTitle = await mounted(
    `export const t = signal(""); export const App = () => <svg>{t() ? <title>{t()}</title> : null}<path d="M0 0" /></svg>;`,
    (host, { t }) => {
      t.set("named");
      const title = host.querySelector("title")!;
      return [title.namespaceURI, title.textContent];
    },
  );
  assert.deepEqual(svgTitle, ["http://www.w3.org/2000/svg", "named"]);
});

test("diagnostics: invalid model / prop / global event / r:slot / textarea children", () => {
  for (const [body, code] of [
    [`<input type="number" model:value={s} />`, "RV1"],
    [`<input prop:innerHTML={s} />`, "RV1"],
    [`<a prop:href="javascript:alert(1)" />`, "RV1"],
    [`<span window:onscroll={s} />`, "RV1"],
    [`<h2 r:slot="x">x</h2>`, "RV6"],
    [`<textarea><b>x</b></textarea>`, "RV1"],
    [`<textarea model:value={s}>x</textarea>`, "RV1"],
  ] as const) {
    const source = `declare const s: any;\nexport const A = () => ${body};`;
    const dom = build(source).diagnostics.map((d) => [d.code, d.message]);
    assert.ok(dom.length > 0 && dom[0]![0]!.startsWith(code), `${body}: ${JSON.stringify(dom)}`);
  }
});
