import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../../index.ts";
test("DOM static trees have one template and ordered targeted bindings", () => {
  const r = compile(`const App=()=> <section><h1>Static</h1><button onClick={handler} title={title()}>{count()}</button></section>`, { target: "dom" });
  assert.deepEqual(r.diagnostics, []);
  assert.equal((r.code.match(/= \/\* @__PURE__ \*\/ __rivet_tpl\(/g) || []).length, 1);
  assert.match(r.code, /__rivet_tpl\("<section><h1>Static<\/h1><button> "\)/);
  assert.match(r.code, /__rivet_on\(_el\$2, "click", handler\)/);
  // Sole dynamic text child: the template's placeholder Text node is walked and bound through `_tx`.
  assert.match(r.code, /_el\$3 = _el\$2\.firstChild;/);
  // Closure-free bindings (OPT-D): writers hoisted to module level, bound in source order.
  assert.match(r.code, /const (__rivetFx\d+) = \(_el\$2\) => __rivet_attrSet\(_el\$2, "title", title\(\)\);/);
  assert.match(r.code, /const __rivetFx\d+ = \(_el\$3\) => \{\s*try \{\s*__rivet_tx\(_el\$3, count\(\)\);/);
  assert.match(r.code, /__rivet_on\(_el\$2, "click", handler\);\n\s*__rivet_fx1\(__rivetFx0, _el\$2\);\n\s*__rivet_fx1\(__rivetFx1, _el\$3\);/);
  assert.doesNotMatch(r.code, /createElement|runtime\/server/);
});
test("components own props factory and provider provenance defers children", () => {
  const r = compile(`import {Provider as P} from '@rivetjs/runtime/dom';const C=()=> <P token={token} value={value}><ui.Child prop={read()}/></P>`, {
    target: "dom",
  });
  assert.deepEqual(r.diagnostics, []);
  assert.match(r.code, /__rivet_c\(P, \{\n\t"token": token,\n\t"value": value,/);
  // Live props: a dynamic prop is a getter on the props object (no `_cp` factory).
  assert.match(r.code, /children: __rivetSlot\(\(\) => __rivet_c\(ui\.Child, __rivetProps\d+\(\(\) => read\(\)\)\)\)/);
  assert.doesNotMatch(r.code, /_cp\b/);
});
test("DOM diagnoses unsupported syntax and model forms", () => {
  for (const source of [
    "const x=<div onMystery={h}/>",
    'const x=<div data-rivet-s0="x"/>',
    'const x=<input type="file" model:value={s}/>',
    "const x=<input model:value={s()}/>",
  ])
    assert.ok(compile(source, { target: "dom" }).diagnostics.length, source);
});
test("parser-repaired form/paragraph/table markup is diagnosed", () => {
  for (const source of ["const x=<form><form/></form>", "const x=<p><div/></p>", "const x=<table>invalid</table>"])
    assert.ok(compile(source, { target: "dom" }).diagnostics.length, source);
});
test("shadowed Provider alias is an ordinary component (lazy children, no Provider lowering)", () => {
  const r = compile(`import {Provider as P} from '@rivetjs/runtime/dom';function render(P){return <P><b>child</b></P>}`, { target: "dom" });
  assert.deepEqual(r.diagnostics, []);
  assert.match(r.code, /__rivet_c\(P, \{ children: __rivetSlot\(\(\) => __rivetTpl0\(\)\) \}\)/);
  assert.doesNotMatch(r.code, /Provider/);
});
test("ambiguous structural helper aliases require named import provenance", () => {
  for (const source of [
    `import * as R from '@rivetjs/runtime/dom';const x=<R.Provider/>`,
    `import {Provider} from '@rivetjs/runtime/dom';const P=Provider;const x=<P/>`,
  ])
    assert.ok(compile(source, { target: "dom" }).diagnostics.length);
});

test("RCDATA uses element bindings and diagnoses structural children", () => {
  const r = compile(`const view=()=> <div><textarea>before:{first()}|{second()}:after</textarea><title>{title()}</title></div>`, { target: "dom" });
  assert.deepEqual(r.diagnostics, []);
  assert.match(r.code, /__rivet_tpl\("<div><textarea><\/textarea><title><\/title>"\)/);
  assert.match(r.code, /__rivet_rcdata\(_el\$2, \[\n\t\t"before:",\n\t\t\(\) => first\(\),\n\t\t"\|",\n\t\t\(\) => second\(\),\n\t\t":after"\n\t\]\)/);
  assert.match(r.code, /__rivet_rcdata\(_el\$3, \[\(\) => title\(\)\]\)/);
  assert.doesNotMatch(r.code, /__rivet_insert|__rivet_t\(/);
  for (const target of ["dom", "server"] as const)
    for (const source of ["const x=<textarea><b>bad</b></textarea>", "const x=<title><C/></title>", "const x=<textarea model:value={signal}>text</textarea>"])
      assert.ok(compile(source, { target }).diagnostics.length, source + " " + target);
});
