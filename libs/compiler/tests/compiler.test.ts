import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";
import { renderToString } from "../../runtime/server.ts";
async function execute(source: string) {
  const result = compile(source, { target: "server", filename: "fixture.tsx" });
  assert.deepEqual(result.diagnostics, []);
  const code = result.code
    .replaceAll("@rivetjs/runtime/server", new URL("../../runtime/server.ts", import.meta.url).href)
    .replaceAll("@rivetjs/runtime/slot", new URL("../../runtime/slot.ts", import.meta.url).href)
    .replaceAll("@rivetjs/reactivity", new URL("../../reactivity/index.ts", import.meta.url).href);
  return { module: await import("data:text/javascript," + encodeURIComponent(code)), code };
}
test("executes TSX with static markup, components, arrays, conditionals and hostile values", async () => {
  const { module, code } = await execute(
    `const Item=({name}:{name:string})=><li title={name}>{name}</li>; const evil='<img onerror="x">&'; export const value=<main><h1>Hello</h1><ul>{[evil,'ok'].map(name=><Item name={name}/>)}</ul>{true?<input disabled checked={false} value={evil}/>:null}</main>;`,
  );
  assert.equal(
    await renderToString(module.value),
    '<main><h1>Hello</h1><ul><li title="&lt;img onerror=&quot;x&quot;&gt;&amp;">&lt;img onerror="x"&gt;&amp;</li><li title="ok">ok</li></ul><input disabled value="&lt;img onerror=&quot;x&quot;&gt;&amp;"></main>',
  );
  assert.doesNotMatch(code, /reactivity|createElement|document/);
});
test("expressions and component setup execute in author order; element children are lazy", async () => {
  const { module } = await execute(
    `export const log=[]; const mark=(n)=>(log.push(n),n); const C=(p)=>(log.push('component'),p.children); export const value=<div a={mark('a')}><C x={mark('prop')}>{mark('child')}</C>{mark('last')}</div>;`,
  );
  // `{mark('child')}` is an expression child of a component: a thunk evaluated where C renders it.
  assert.deepEqual(module.log, ["a", "prop", "component", "last"]);
  assert.equal(await renderToString(module.value), '<div a="a">childlast</div>');
  assert.deepEqual(module.log, ["a", "prop", "component", "last", "child"]);
});
test("unsupported syntax is explicit and cannot emit executable code", () => {
  for (const source of ["const x=<div>{...p}</div>", "const x=<script>{code}</script>", "const x=<div onUnknown={fn}/>", "const x=<input>bad</input>"]) {
    const result = compile(source, { target: "server" });
    assert.ok(result.diagnostics.length);
    assert.equal(result.code, "");
  }
  assert.deepEqual(compile("const x=<div/>", { target: "dom" }).diagnostics, []);
});
test("static native nesting does not allocate per element", async () => {
  const { code, module } = await execute("export const value=<div><section><p>Hello</p><br/></section></div>");
  assert.equal(await renderToString(module.value), "<div><section><p>Hello</p><br></section></div>");
  assert.equal((code.match(/__rivetTemplate\(/g) || []).length, 1);
});
test("JSX entities and multiline whitespace match author text and hoist static attributes", async () => {
  const { module, code } = await execute(`export const value=<div title="A &amp; B" className="card">Hello &lt;world&gt;\n  next <span>one</span></div>`);
  assert.equal(await renderToString(module.value), '<div title="A &amp; B" class="card">Hello &lt;world&gt; next <span>one</span></div>');
  assert.doesNotMatch(code, /__rivetAttribute\(/);
});
test("fragments and async components compose through nested expressions", async () => {
  const { module } = await execute(`const C=async()=> <b>{await Promise.resolve('<x>')}</b>; export const value=<><C/>{[0,false,null]}<i>done</i></>`);
  assert.equal(await renderToString(module.value), "<b>&lt;x&gt;</b>0<i>done</i>");
});
test("URL validation and output use one observable coercion", async () => {
  const { module } = await execute(
    `export let calls=0; const changing={toString(){return ++calls===1?'https://example.com':'javascript:alert(1)'}}; export const value=<a href={changing}>go</a>;`,
  );
  assert.equal(await renderToString(module.value), '<a href="https://example.com">go</a>');
  assert.equal(module.calls, 1);
});
test("lowercase member component lookup preserves getter, prop and setup order (children lazy)", async () => {
  const { module } = await execute(
    `export const log=[]; const mark=x=>(log.push(x),x); const ui={get C(){log.push('get'); return p=>(log.push('setup'),p.children)}}; export const value=<ui.C prop={mark('prop')}>{mark('child')}</ui.C>;`,
  );
  assert.deepEqual(module.log, ["get", "prop", "setup"]);
  assert.equal(await renderToString(module.value), "child");
  assert.deepEqual(module.log, ["get", "prop", "setup", "child"]);
});
test("async admission does not evaluate deferred function children ahead of writes", async () => {
  const { module } = await execute(`export const log=[];export const value=<div>{()=>{log.push('deferred');return 'x'}}</div>;`);
  const { renderToWriter } = await import("../../runtime/server.ts");
  let release: ((value?: any) => void) | undefined;
  const rendering = renderToWriter(module.value, {
    write(chunk: string) {
      if (chunk === "<div>") return new Promise((resolve) => (release = resolve));
    },
  });
  assert.deepEqual(module.log, []);
  release!();
  await rendering;
  assert.deepEqual(module.log, ["deferred"]);
});
// A call as the handler value is RV1016 (handlers bind once); `(call, undefined)` keeps its bind-time evaluation under test.
test("SSR event evaluation is ordered and omitted, and models read once", async () => {
  const { module } = await execute(
    `export const log=[];const mark=(name,value)=>(log.push(name),value);const text=()=>mark('model','<typed>');export const value=<div title={mark('attr','a')} onClick={(mark('event',()=>{throw Error('handler invoked')}),undefined)}><textarea model:value={text}/>{mark('child','end')}</div>`,
  );
  assert.deepEqual(module.log, ["attr", "event", "model", "child"]);
  assert.equal(await renderToString(module.value), '<div title="a"><textarea>\n&lt;typed&gt;</textarea>end</div>');
});
test("server rewrites known structural imports and preserves Provider deferred children", async () => {
  const { module, code } = await execute(
    `import {Provider as P,For} from '@rivetjs/runtime/dom';import {createContext,useContext} from '@rivetjs/reactivity';const token=createContext('default');const C=()=> <b>{useContext(token)}</b>;export const value=<P token={token} value="nearest"><C/><For each={()=>['a','b']} by={x=>x}>{(row,index)=><i>{row()}{index()}</i>}</For></P>`,
  );
  assert.doesNotMatch(code, /runtime\/dom/);
  assert.equal(await renderToString(module.value), "<b>nearest</b><i>a0</i><i>b1</i>");
});
test("SSR SVG attributes preserve nonboolean false values", async () => {
  const { module } = await execute(`export const value=<svg disabled={false}><circle disabled="false"/></svg>`);
  assert.equal(await renderToString(module.value), '<svg disabled="false"><circle disabled="false"></circle></svg>');
});

test("compiled native scalar regions batch output while public templates retain ordered writes", async () => {
  const { module, code } = await execute(`export const value=<div>{'<x>'}{1}{false}{null}<b>{2n}</b></div>`);
  assert.match(code, /compiledTemplate as __rivetTemplate/);
  const { renderToWriter, template } = await import("../../runtime/server.ts");
  const chunks: string[] = [];
  await renderToWriter(module.value, {
    write(chunk: string) {
      chunks.push(chunk);
    },
  });
  assert.deepEqual(chunks, ["<div>&lt;x&gt;1<b>2</b></div>"]);
  const publicChunks: string[] = [];
  await renderToWriter(template(["a", "c"], ["b"]), {
    write(chunk: string) {
      publicChunks.push(chunk);
    },
  });
  assert.deepEqual(publicChunks, ["a", "b", "c"]);
});

test("compiled batching flushes before invoking deferred children and awaits acknowledgment", async () => {
  const { module } = await execute(`export const log=[]; export const value=<div>{'a'}{()=>{log.push('deferred');return 'b'}}{'c'}</div>`);
  const { renderToWriter } = await import("../../runtime/server.ts");
  const chunks: string[] = [];
  let release: ((value?: any) => void) | undefined;
  const rendering = renderToWriter(module.value, {
    write(chunk: string) {
      chunks.push(chunk);
      if (chunks.length === 1)
        return new Promise((resolve) => {
          release = resolve;
        });
    },
  });
  assert.deepEqual(chunks, ["<div>a"]);
  assert.deepEqual(module.log, []);
  release!();
  await rendering;
  assert.deepEqual(module.log, ["deferred"]);
  assert.equal(chunks.join(""), "<div>abc</div>");
});
test("G9 select: value goes to option matching on the server, a deferred binding on the DOM; unused costs nothing", () => {
  const plain = `export const A = () => <select name="s"><option value="a">A</option></select>;`;
  for (const target of ["server", "dom"] as const) {
    const { code, diagnostics } = compile(plain, { target, filename: "a.tsx" });
    assert.deepEqual(diagnostics, []);
    assert.doesNotMatch(code, /__rivetSelect|__rivet_select/);
  }
  const source = `export const A = (p: { v: string }) => <select value={p.v}>{["a"].map((o) => <option value={o}>{o}</option>)}<option>b</option></select>;`;
  const server = compile(source, { target: "server", filename: "a.tsx" });
  assert.deepEqual(server.diagnostics, []);
  assert.match(server.code, /__rivetOmitted\(__rivetSelect = p\.v\)/);
  assert.match(server.code, /__rivetAttribute\("selected", __rivetSelected\(__rivetSelect, "b"\)\)/);
  assert.doesNotMatch(server.code, /__rivetAttribute\("value", p\.v\)/);
  const dom = compile(source, { target: "dom", filename: "a.tsx" });
  assert.deepEqual(dom.diagnostics, []);
  // After the children's bindings.
  assert.match(dom.code, /__rivet_insert\(_el\$1, [\s\S]*__rivet_select\(_el\$1, \(\) => p\.v\);\n\treturn _el\$1;/);
  const model = compile(
    `import { signal } from "@rivetjs/reactivity"; const s = signal(["a"]); export const B = () => <select multiple model:value={s}><option value="a">A</option></select>;`,
    { target: "dom", filename: "b.tsx" },
  );
  assert.deepEqual(model.diagnostics, []);
  assert.match(model.code, /__rivet_select\(_el\$1, s, s\)/);
});
