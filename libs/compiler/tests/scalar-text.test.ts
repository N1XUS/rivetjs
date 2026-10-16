import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";

test("untagged template children are scalar text: a static one folds to textContent, a reading one is a sole-child text effect", () => {
  for (const expression of ["`value-${read()}`", "(`value-${read()}`)"]) {
    const result = compile(`export const A = () => <p>{${expression}}</p>`, { target: "dom", filename: "text.tsx" });
    assert.deepEqual(result.diagnostics, []);
    // Closure-free binding (OPT-D): the hoisted writer takes the template's placeholder Text (`_tx`, IMPL-DOM F2);
    // `read` is a global.
    assert.ok(result.code.includes('__rivet_tpl("<p> ")'), result.code);
    assert.match(result.code, /_el\$1 = __rivetTpl\d+\(\),\s*_el\$2 = _el\$1\.firstChild/);
    assert.match(
      result.code,
      /const __rivetFx0 = \(_el\$2\) => \{\s*try \{\s*__rivet_tx\(_el\$2, `value-\$\{read\(\)\}`\);\s*\} catch \((\w+)\) \{\s*__rivet_tx\(_el\$2, null\);/,
    );
    assert.match(result.code, /__rivet_fx1\(__rivetFx0, _el\$2\);/);
    assert.doesNotMatch(result.code, /__rivet_t\(/);
    assert.doesNotMatch(result.code, /_insert|_textValue/);
  }
  const result = compile("export const A = () => <p>{`<${object}>`}</p>", { target: "dom", filename: "text.tsx" });
  assert.deepEqual(result.diagnostics, []);
  assert.match(result.code, /_el\$1\.textContent = `<\$\{object\}>`;/);
  assert.doesNotMatch(result.code, /_insert|_textValue|__rivet_t\(/);
});

test("tagged templates and unknown child values keep the generic child writer and RCDATA stays specialized", () => {
  // No JSX in the value: the placeholder Text writer (`_tx` switches to insertion at runtime for node values).
  for (const expression of ["tag`value-${read()}`", "read()"]) {
    const result = compile(`export const A = () => <p>{${expression}}</p>`, { target: "dom", filename: "child.tsx" });
    assert.deepEqual(result.diagnostics, []);
    assert.match(result.code, /__rivet_tx\(_el\$2, /);
    assert.doesNotMatch(result.code, /textContent|__rivet_t\(/);
  }
  // Slot content and JSX inside the value: no placeholder, the element-level writers.
  for (const [source, tpl] of [
    ["<p>{props.children}</p>", "<p>"],
    ["<ul>{read().map((x) => <li>{x}</li>)}</ul>", "<ul>"],
  ]) {
    const result = compile(`export const A = (props) => ${source}`, { target: "dom", filename: "child.tsx" });
    assert.deepEqual(result.diagnostics, [], source);
    assert.doesNotMatch(result.code, /__rivet_tx/, source);
    assert.ok(result.code.includes(`__rivet_tpl("${tpl}")`), result.code);
  }
  // A conditional with a JSX branch memoizes its test (`_cond`); `_textValue` binds the accessor through the generic writer.
  const cond = compile("export const A = () => <p>{flag() ? `one` : <b/>}</p>", { target: "dom", filename: "child.tsx" });
  assert.deepEqual(cond.diagnostics, []);
  assert.match(cond.code, /__rivet_textValue\(_el\$1, __rivet_cond\(\(\) => flag\(\), 0, /);
  assert.doesNotMatch(cond.code, /textContent/);
  const value = compile("export const A = () => <p>{value}</p>", { target: "dom", filename: "child.tsx" });
  assert.deepEqual(value.diagnostics, []);
  assert.match(value.code, /__rivet_textValue\(_el\$1, value\)/);
  for (const tag of ["textarea", "title"]) {
    const result = compile(`export const A = () => <${tag}>{\`value-\${read()}\`}</${tag}>`, { target: "dom", filename: "rcdata.tsx" });
    assert.deepEqual(result.diagnostics, []);
    assert.match(result.code, /__rivet_rcdata\(_el\$1, \[\(\) => `value-\$\{read\(\)\}`\]\)/);
    assert.doesNotMatch(result.code, /__rivet_t\(|textContent/);
  }
});
