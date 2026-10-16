import { test } from "vitest";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { compile } from "../index.ts";
const runtimeURL = new URL("../../runtime/server.ts", import.meta.url).href;
function subprocess(source: string, body: string) {
  const { code, diagnostics } = compile(source, { target: "server", filename: "siblings.tsx" });
  assert.deepEqual(diagnostics, []);
  const moduleURL =
    "data:text/javascript," +
    encodeURIComponent(code.replaceAll("@rivetjs/runtime/server", runtimeURL).replaceAll("@rivetjs/runtime/slot", runtimeURL.replace("server.ts", "slot.ts")));
  const script = `import {renderToString,renderToWriter} from ${JSON.stringify(runtimeURL)}; const {value}=await import(${JSON.stringify(moduleURL)}); ${body}`;
  return spawnSync(process.execPath, ["--unhandled-rejections=strict", "--input-type=module", "-e", script], {
    encoding: "utf8",
    timeout: 3000,
  });
}
const source = `const Slow=async()=>{await new Promise(r=>setTimeout(r,30));return 'first'}; const Failing=async()=>{throw new Error('second sibling failed')}; export const value=<div><Slow/><Failing/></div>;`;
test("compiled pending and rejecting siblings remain handled and eventually propagate error", () => {
  const result = subprocess(
    source,
    `try { await renderToString(value); throw new Error('expected failure'); } catch(error){if(error.message!=='second sibling failed')throw error;} await new Promise(r=>setTimeout(r,40)); console.log('alive');`,
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /alive/);
});
test("already-created child rejection stays handled during writer backpressure", () => {
  const result = subprocess(
    source,
    `try { await renderToWriter(value,{write(){return new Promise(r=>setTimeout(r,30))}}); throw new Error('expected failure'); } catch(error){if(error.message!=='second sibling failed')throw error;} console.log('alive');`,
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /alive/);
});
test("abort and earlier writer failure leave later sibling rejection observed", () => {
  for (const body of [
    `const controller=new AbortController(); const result=renderToString(value,{signal:controller.signal}); controller.abort(new Error('cancelled')); try{await result;}catch(error){if(error.message!=='cancelled')throw error;} await new Promise(r=>setTimeout(r,60)); console.log('alive');`,
    `try{await renderToWriter(value,{write(){throw new Error('writer failed')}});}catch(error){if(error.message!=='writer failed')throw error;} await new Promise(r=>setTimeout(r,60)); console.log('alive');`,
  ]) {
    const result = subprocess(source, body);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /alive/);
  }
});
test("an earlier child failure leaves later asynchronous failure observed", () => {
  const result = subprocess(
    `const First=async()=>{throw new Error('first failed')}; const Later=async()=>{await new Promise(r=>setTimeout(r,20));throw new Error('later failed')}; export const value=<><First/><Later/></>;`,
    `try{await renderToString(value);throw new Error('expected failure');}catch(error){if(error.message!=='first failed')throw error;}await new Promise(r=>setTimeout(r,50));console.log('alive');`,
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /alive/);
});
test("a resolved async child admits its formed nested siblings before traversal", () => {
  const result = subprocess(
    `const C=async()=>{await Promise.resolve(); const slow=new Promise(r=>setTimeout(()=>r('first'),30)); const failed=Promise.reject(new Error('nested sibling failed')); return <div>{[slow,failed]}</div>}; export const value=<C/>;`,
    `try{await renderToString(value);throw new Error('expected failure');}catch(error){if(error.message!=='nested sibling failed')throw error;}console.log('alive');`,
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /alive/);
});
// A call as the handler value is RV1016 (handlers bind once); a member read of a fresh object keeps the rejected
// promise as the bind-time handler value under test.
test("compiled event Promise rejection stays observed behind a pending sibling", () => {
  const result = subprocess(
    `const Slow=async()=>{await new Promise(r=>setTimeout(r,30));return 'first'};export const value=<div><Slow/><button onClick={({handler:Promise.reject(new Error('event failed'))}).handler}>button</button></div>`,
    `try{await renderToString(value);throw Error('expected failure')}catch(error){if(error.message!=='event failed')throw error}console.log('alive')`,
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /alive/);
});
