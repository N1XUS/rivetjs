import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";
import { renderToString } from "../../runtime/server.ts";

async function server(source: string) {
  const result = compile(source, { target: "server", filename: "fixture.tsx" });
  assert.deepEqual(result.diagnostics, []);
  const code = result.code
    .replaceAll("@rivetjs/runtime/server", new URL("../../runtime/server.ts", import.meta.url).href)
    .replaceAll("@rivetjs/runtime/slot", new URL("../../runtime/slot.ts", import.meta.url).href)
    .replaceAll("@rivetjs/reactivity", new URL("../../reactivity/index.ts", import.meta.url).href);
  return { module: await import("data:text/javascript," + encodeURIComponent(code)), code };
}
const errors = (source: string, target: "server" | "dom" = "server") => compile(source, { target, filename: "fixture.tsx" }).diagnostics.map((d) => d.message);

const card = `
function Card(props: any) {
  return (
    <article>
      <header><slot r:name="header"><h2>Untitled</h2></slot></header>
      <slot />
      <footer><slot r:name="footer" /></footer>
    </article>
  );
}`;

test("named and default slots render usage content; fallback only when the slot is absent", async () => {
  const { module } = await server(
    card +
      `export const filled = <Card><h2 r:slot="header">Title</h2>Body <b>bold</b><small r:slot="footer">f</small></Card>;
       export const empty = <Card>Only body</Card>;`,
  );
  assert.equal(await renderToString(module.filled), "<article><header><h2>Title</h2></header>Body <b>bold</b><footer><small>f</small></footer></article>");
  assert.equal(await renderToString(module.empty), "<article><header><h2>Untitled</h2></header>Only body<footer></footer></article>");
});

test("slot content is lazy: an unrendered slot runs nothing", async () => {
  const { module } = await server(
    `export const log: string[] = [];
     const mark = (s: string) => (log.push(s), s);
     function Maybe({ show, extra, never }: any) { return <div>{show ? extra : null}<slot r:name="never" /></div>; }
     export const view = <Maybe show={false}><i r:slot="extra">{mark("extra")}</i></Maybe>;
     export const other = <Maybe show={true}><i r:slot="extra">{mark("shown")}</i></Maybe>;`,
  );
  assert.equal(await renderToString(module.view), "<div></div>");
  assert.deepEqual(module.log, []);
  assert.equal(await renderToString(module.other), "<div><i>shown</i></div>");
  assert.deepEqual(module.log, ["shown"]);
});

test("destructured props, several elements per slot, components as slot content", async () => {
  const { module } = await server(
    `function Icon({ name }: { name: string }) { return <i>{name}</i>; }
     function List({ items, children }: any) { return <ul><slot r:name="items" /><slot>empty</slot></ul>; }
     export const view = <List><li r:slot="items">a</li><li r:slot="items">b</li><Icon r:slot="items" name="c" /></List>;`,
  );
  assert.equal(await renderToString(module.view), "<ul><li>a</li><li>b</li><i>c</i>empty</ul>");
});

test("scoped slots call the slot with r:args; function props and function children work as slots", async () => {
  const { module } = await server(
    `import { For } from "@rivetjs/runtime/server";
     function Rows(props: any) {
       return <ol><For each={() => props.items} by={(s: string) => s}>{(item: () => string, i: () => number) => <slot r:name="row" r:args={[item, i]}><li>{item()}</li></slot>}</For></ol>;
     }
     export const custom = <Rows items={["x", "y"]} row={(item: () => string, i: () => number) => <li>{i()}:{item()}</li>} />;
     export const plain = <Rows items={["x"]} />;
     function Lazy(props: any) { return <p><slot /></p>; }
     export const fn = <Lazy>{() => <b>lazy</b>}</Lazy>;`,
  );
  assert.equal(await renderToString(module.custom), "<ol><li>0:x</li><li>1:y</li></ol>");
  assert.equal(await renderToString(module.plain), "<ol><li>x</li></ol>");
  assert.equal(await renderToString(module.fn), "<p><b>lazy</b></p>");
});

test("a slot as the component root and inside a fragment", async () => {
  const { module } = await server(
    `function Pass(props: any) { return <slot>none</slot>; }
     function Frag({ a }: any) { return <><slot r:name="a" />!</>; }
     export const one = <Pass><b>yes</b></Pass>;
     export const two = <Pass />;
     export const three = <Frag><i r:slot="a">a</i></Frag>;`,
  );
  assert.equal(await renderToString(module.one), "<b>yes</b>");
  assert.equal(await renderToString(module.two), "none");
  assert.equal(await renderToString(module.three), "<i>a</i>!");
});

test("native <slot> stays native inside <template> and with a plain name attribute", async () => {
  const { module } = await server(`export const view = <div><template shadowrootmode="open"><slot /><slot name="x" /></template><slot name="y" /></div>;`);
  assert.equal(
    await renderToString(module.view),
    '<div><template shadowrootmode="open"><slot></slot><slot name="x"></slot></template><slot name="y"></slot></div>',
  );
});

test("DOM target lowers slots to props reads and thunks", () => {
  const r = compile(card + `export const view = () => <Card><h2 r:slot="header">T</h2>Body</Card>;`, { target: "dom", filename: "fixture.tsx" });
  assert.deepEqual(r.diagnostics, []);
  assert.match(r.code, /props\.header \?\?/);
  assert.match(r.code, /"?header"?: \(\) =>/);
  assert.doesNotMatch(r.code, /r:slot|r:name|<slot/);
});

test("DOM target: a <slot> over a props member is an accessor (conditional r:slot content updates); destructured stays a value", () => {
  const r = compile(card + `export const view = (p: any) => <Card>{p.on() && <h2 r:slot="header">T</h2>}Body</Card>;`, {
    target: "dom",
    filename: "fixture.tsx",
  });
  assert.deepEqual(r.diagnostics, []);
  assert.match(r.code, /__rivet_textValue\(_el\$\d+, \(\) => props\.header \?\? __rivetTpl\d+\(\)\);/);
  assert.match(r.code, /__rivet_insert\(_el\$\d+, \(\) => props\.children, _el\$\d+\);/);
  assert.match(r.code, /__rivet_textValue\(_el\$\d+, \(\) => props\.footer\);/);
  const destructured = compile(`function C({ header }: any) { return <div><slot r:name="header" /></div>; }`, { target: "dom", filename: "fixture.tsx" });
  assert.deepEqual(destructured.diagnostics, []);
  assert.match(destructured.code, /__rivet_textValue\(_el\$\d+, header\);/);
});

test("slot diagnostics", () => {
  for (const target of ["server", "dom"] as const) {
    assert.match(errors(`function C({ a }: any) { return <slot r:name="b" />; }`, target).join(), /add `b` to the destructured props of C/);
    assert.match(errors(`function C() { return <slot r:name="b" />; }`, target).join(), /component's props parameter/);
    assert.match(errors(`const x = <slot r:name="b" />;`, target).join(), /inside a component/);
    assert.match(errors(`function C(p: any) { return <slot r:name={name} />; }`, target).join(), /r:name must be a string literal/);
    assert.match(errors(`const x = <div><b r:slot="a" /></div>;`, target).join(), /r:slot is only allowed on a direct child of a component element/);
    assert.match(errors(`const x = <C a={1}><b r:slot="a" /></C>;`, target).join(), /slot "a" is also passed as an attribute/);
    assert.match(errors(`const x = <C><b r:slot={a} /></C>;`, target).join(), /r:slot must be a string literal/);
    assert.match(errors(`const x = <C><b r:slot="children" /></C>;`, target).join(), /default slot/);
  }
});

test("modules without slot syntax compile unchanged by the slot pass", () => {
  // Function props passed to components are ordinary values.
  const source = `function C(p: any) { return <div>{p.header}</div>; } export const v = <C header={() => <b/>}><i/></C>;`;
  for (const target of ["server", "dom"] as const) {
    const r = compile(source, { target, filename: "fixture.tsx" });
    assert.deepEqual(r.diagnostics, []);
    assert.match(r.code, /"?header"?: \(\) =>/);
  }
});
