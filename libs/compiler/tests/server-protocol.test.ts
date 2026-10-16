import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";
import { renderToWriter, renderToString } from "../../runtime/server.ts";
import { spawnSync } from "node:child_process";

/** Execute compiled server modules: the server backend's semantic oracle (capture order, coercion, writes). */
async function execute(source: string) {
  const { code, diagnostics } = compile(source, { target: "server", filename: "server-protocol.tsx" });
  assert.deepEqual(diagnostics, []);
  const emitted = code
    .replaceAll("@rivetjs/runtime/server", new URL("../../runtime/server.ts", import.meta.url).href)
    .replaceAll("@rivetjs/runtime/slot", new URL("../../runtime/slot.ts", import.meta.url).href);
  return import("data:text/javascript," + encodeURIComponent(emitted));
}

test("protocol oracle separates eager getter/Proxy/component capture from acknowledged attribute coercion", async () => {
  const module = await execute(`
    export const log=[];let state='before';export const mutate=()=>{state='after'};
    const mark=(name,value)=>(log.push(name),value);
    const row=new Proxy({text:'<x>'},{get(t,k,r){log.push('proxy:'+String(k));return Reflect.get(t,k,r)}});
    const attr={toString(){log.push('coerce:'+state);return state}};
    const ui={get C(){log.push('callee');return p=>(log.push('setup'),p.children)}};
    export const make=()=> <div title={mark('attr',attr)}><ui.C p={row.text}>{row.text}</ui.C>{row.text}</div>;
  `);
  const value = module.make();
  const captures = ["attr", "callee", "proxy:text", "proxy:text", "setup", "proxy:text"];
  assert.deepEqual(module.log, captures);
  const chunks: string[] = [];
  let release: ((value?: any) => void) | undefined;
  const rendering = renderToWriter(value, {
    write(chunk: string) {
      chunks.push(chunk);
      if (chunks.length === 1)
        return new Promise((done) => {
          release = done;
        });
    },
  });
  assert.deepEqual(chunks, ["<div"]);
  assert.deepEqual(module.log, captures);
  module.mutate();
  release!();
  await rendering;
  assert.deepEqual(module.log, [...captures, "coerce:after"]);
  assert.deepEqual(chunks, ["<div", ' title="after"', ">&lt;x&gt;&lt;x&gt;</div>"]);
});

test("protocol oracle keeps ordinary map eager, retaining references but not pre-coercing them", async () => {
  const module = await execute(`
    export const log=[];let version='old';export const change=()=>{version='new'};
    const rows=[0,1,2].map(id=>({get title(){log.push('get:'+id);return {toString(){log.push('coerce:'+id+':'+version);return version+id}}}}));
    export const make=()=> <ul>{rows.map((row,index)=>{log.push('map:'+index);return <li title={row.title}>{index}</li>})}</ul>;
  `);
  const value = module.make();
  const captures = ["map:0", "get:0", "map:1", "get:1", "map:2", "get:2"];
  assert.deepEqual(module.log, captures);
  let release: ((value?: any) => void) | undefined;
  const chunks: string[] = [];
  const rendering = renderToWriter(value, {
    write(chunk: string) {
      chunks.push(chunk);
      if (chunks.length === 1)
        return new Promise((done) => {
          release = done;
        });
    },
  });
  assert.deepEqual(module.log, captures);
  assert.deepEqual(chunks, ["<ul>"]);
  module.change();
  release!();
  await rendering;
  assert.deepEqual(module.log, [...captures, "coerce:0:new", "coerce:1:new", "coerce:2:new"]);
  assert.equal(chunks.join(""), '<ul><li title="new0">0</li><li title="new1">1</li><li title="new2">2</li></ul>');
});

test("protocol oracle later-row setup exceptions occur before any rendering or coercion", async () => {
  const module = await execute(`export const log=[];export const make=()=> <ul>{[0,1,2].map(id=>{
    log.push('map:'+id);if(id===2)throw Error('last setup');
    return <li title={{toString(){log.push('coerce:'+id);return id}}}>{id}</li>;
  })}</ul>`);
  assert.throws(module.make, /last setup/);
  assert.deepEqual(module.log, ["map:0", "map:1", "map:2"]);
});

test("protocol oracle primitive-looking external operators still perform eager user coercion", async () => {
  const module = await execute(`export const log=[];const external={ [Symbol.toPrimitive](hint){log.push('operator:'+hint);return 2} };
    export const value=<b>{external+1}</b>`);
  assert.deepEqual(module.log, ["operator:default"]);
  assert.equal(renderToString(module.value), "<b>3</b>");
  assert.deepEqual(module.log, ["operator:default"]);
});

// Rivet requires untampered built-ins: compiler records are never probed for an inherited then.
test("compiler records skip thenable probing under the untampered built-ins contract", () => {
  const { code, diagnostics } = compile("export const value=<b>literal</b>", { target: "server" });
  assert.deepEqual(diagnostics, []);
  const runtimeURL = new URL("../../runtime/server.ts", import.meta.url).href;
  const moduleURL =
    "data:text/javascript," +
    encodeURIComponent(code.replaceAll("@rivetjs/runtime/server", runtimeURL).replaceAll("@rivetjs/runtime/slot", runtimeURL.replace("server.ts", "slot.ts")));
  // Isolate prototype mutation so the test runner and neighboring tests are unaffected.
  const script = `import assert from 'node:assert/strict';import {renderToString} from ${JSON.stringify(runtimeURL)};
    const {value}=await import(${JSON.stringify(moduleURL)});let reads=0;
    Object.defineProperty(Object.prototype,'then',{configurable:true,get(){reads++;return undefined}});
    try {assert.equal(renderToString(value),'<b>literal</b>');assert.equal(reads,0)}
    finally {delete Object.prototype.then}`;
  const result = spawnSync(process.execPath, ["--unhandled-rejections=strict", "--input-type=module", "-e", script], {
    encoding: "utf8",
    timeout: 5000,
  });
  assert.equal(result.status, 0, result.stderr);
});
