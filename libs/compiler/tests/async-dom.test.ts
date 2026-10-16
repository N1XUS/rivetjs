import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";
import { build } from "esbuild";
test("server clientOnly aliases erase inline browser import and selector without suppressing options", async () => {
  const result = compile(
    `import {clientOnly as browserOnly,Async,lazyComponent} from '@rivetjs/runtime/dom';export const log=[];const Client=browserOnly(()=>import('./browser-unsafe.mjs'),m=>m.default,{fallback:props=>(log.push(props.label),<span>{props.label}</span>)});export const value=<Client label="<&fallback>"/>`,
    { target: "server" },
  );
  assert.deepEqual(result.diagnostics, []);
  assert.doesNotMatch(result.code, /browser-unsafe/);
  const server = new URL("../../runtime/server.ts", import.meta.url).href;
  const module = await import(
    "data:text/javascript," +
      encodeURIComponent(result.code.replaceAll("@rivetjs/runtime/server", server).replaceAll("@rivetjs/runtime/slot", server.replace("server.ts", "slot.ts")))
  );
  const { renderToString } = await import("../../runtime/server.ts");
  assert.equal(await renderToString(module.value), "<span>&lt;&amp;fallback&gt;</span>");
  assert.deepEqual(module.log, ["<&fallback>"]);
  const bundle = await build({
    stdin: { contents: result.code, resolveDir: process.cwd() },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    metafile: true,
  });
  assert.doesNotMatch(Object.keys(bundle.metafile.inputs).join("\n"), /browser-unsafe|runtime\/dom.ts/);
});
test("server clientOnly erasure diagnoses unsupported provenance and evaluation patterns", () => {
  for (const source of [
    `import {clientOnly} from '@rivetjs/runtime/dom';const importer=()=>import('./browser.js');const C=clientOnly(importer)`,
    `import {clientOnly} from '@rivetjs/runtime/dom';const C=clientOnly(()=>import('./browser.js'),getSelector())`,
    `import * as runtime from '@rivetjs/runtime/dom';const C=runtime.clientOnly(()=>import('./browser.js'))`,
    `import * as R from '@rivetjs/runtime/dom';const C=R['clientOnly'](()=>import('browser-unsafe'))`,
    `import * as R from '@rivetjs/runtime/dom';const {clientOnly}=R;const C=clientOnly(()=>import('browser-unsafe'))`,
    `import * as R from '@rivetjs/runtime/dom';const alias=R;const C=alias.clientOnly(()=>import('browser-unsafe'))`,
    `export {clientOnly} from '@rivetjs/runtime/dom'`,
    `import {clientOnly} from '@rivetjs/runtime/dom';function scoped(undefined){return clientOnly(()=>import('./browser.js'),undefined)}`,
    `import {clientOnly} from '@rivetjs/runtime/dom';const helpers={clientOnly};const C=helpers.clientOnly(()=>import('./browser.js'))`,
  ]) {
    const r = compile(source, { target: "server" });
    assert.notEqual(r.diagnostics.length, 0, source);
    assert.equal(r.code, "");
  }
  const shadow = compile(`import {clientOnly as make} from '@rivetjs/runtime/dom';function scope(make){return make(()=>import('./ordinary.js'))}`, {
    target: "server",
  });
  assert.deepEqual(shadow.diagnostics, []);
  assert.match(shadow.code, /ordinary.js/);
});
test("DOM async bundle includes neutral lazy but excludes server and compiler dependencies", async () => {
  const r = compile(
    `import {Async,lazyComponent,clientOnly,mount} from '@rivetjs/runtime/server';const L=lazyComponent(()=>Promise.resolve({default:()=> <b>loaded</b>}));export const run=host=>mount(()=> <Async load={()=>'value'}>{value=> <L/>}</Async>,host)`,
    { target: "dom" },
  );
  assert.deepEqual(r.diagnostics, []);
  const bundle = await build({
    stdin: { contents: r.code, resolveDir: process.cwd() },
    bundle: true,
    platform: "browser",
    format: "esm",
    write: false,
    metafile: true,
  });
  const graph = Object.keys(bundle.metafile.inputs).join("\n");
  assert.match(graph, /runtime\/lazy.ts/);
  assert.doesNotMatch(graph, /compiler\/|typescript|entities|runtime\/server|node:/);
});

test("namespace helper escape preflight suppresses a real browser-only server bundle graph", async () => {
  for (const access of ["R['clientOnly']", "((({clientOnly})=>clientOnly)(R))"]) {
    const r = compile(`import * as R from '@rivetjs/runtime/dom';export const C=${access}(()=>import('browser-unsafe'))`, { target: "server" });
    const bundle = await build({
      stdin: { contents: r.code, resolveDir: process.cwd() },
      bundle: true,
      platform: "node",
      format: "esm",
      write: false,
      metafile: true,
      plugins: [
        {
          name: "browser-proof",
          setup(b) {
            b.onResolve({ filter: /^browser-unsafe$/ }, () => ({ path: "browser-unsafe", namespace: "browser-proof" }));
            b.onLoad({ filter: /.*/, namespace: "browser-proof" }, () => ({
              contents: "window.__browserUnsafe=true;export default()=> 'browser'",
              loader: "js",
            }));
          },
        },
      ],
    });
    assert.doesNotMatch(Object.keys(bundle.metafile.inputs).join("\n"), /browser-proof/);
    assert.notEqual(r.diagnostics.length, 0);
    assert.equal(r.code, "");
  }
});
