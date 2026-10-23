import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";

// Lane IMPL-SPREAD (2026-10-09). F1: plain attributes after an element's last `{...spread}` lower on their own
// (`compile/dom_v2_spread.rs`): static → template text, the rest → one `_attrs(el, values, "names")` binding, and the
// spread excludes their names.
const dom = (source: string) => compile(source, { target: "dom", filename: "m.tsx" });
const server = (source: string) => compile(source, { target: "server", filename: "m.tsx" });

test("F1: trailing attributes after the last spread: static in the template, dynamic in one `_attrs`, names excluded from the spread", () => {
  const r = dom(
    `export const view = (attrs: any, a: any, id: () => string, label: string) => <div>
  <button title="before" {...attrs} type="button" id={id()} aria-label={label} data-x={a.x} tabIndex={-1} className={a.c}>b</button>
</div>;`,
  );
  assert.deepEqual(r.diagnostics, []);
  // Static trailing attributes: template text (`tabIndex={-1}` is an expression: in the binding).
  assert.ok(r.code.includes('__rivet_tpl("<div><button type=button>b")'), r.code);
  // Before the spread: stays in the object (the spread wins); the spread excludes every trailing name (HTML lowercase twins).
  assert.match(
    r.code,
    /__rivet_spread\(_el\$\d+, \(\) => \(\{\s*"title": "before",\s*\.\.\.attrs\s*\}\), 0, null, "type id aria-label data-x tabindex tabIndex class"\);/,
  );
  // One binding, after the spread (source order of the merged object), `className` normalized.
  assert.match(r.code, /__rivet_attrs\(_el\$\d+, \(\) => \[\s*id\(\),\s*label,\s*a\.x,\s*-1,\s*a\.c\s*\], "id aria-label data-x tabIndex class"\);/);
  assert.match(r.code, /import \{[^}]*_attrs as __rivet_attrs[^}]*\} from "@rivetjs\/runtime\/dom"/);
});

test("F1: a lone identifier spread with static trailing attributes stays uncopied (flag 2); no binding without a dynamic one", () => {
  const r = dom(`export const view = (attrs: any, n: number) => <div><span {...attrs} data-slot="x" /><i {...attrs} data-n={n}>i</i></div>;`);
  assert.deepEqual(r.diagnostics, []);
  assert.ok(r.code.includes('__rivet_tpl("<div><span data-slot=x></span><i>i")'), r.code);
  // No JSX children: content flag 1 + uncopied flag 2.
  assert.match(r.code, /__rivet_spread\(_el\$\d+, attrs, 3, null, "data-slot"\);/);
  // A value that reads no state: a plain array (the runtime binds only when a value is an accessor).
  assert.match(r.code, /__rivet_spread\(_el\$\d+, attrs, 2, null, "data-n"\);\s*__rivet_attrs\(_el\$\d+, \[n\], "data-n"\);/);
});

test("F1: ref after the spread is excluded; children / directive / control elements keep the merged object", () => {
  const r = dom(`export const view = (attrs: any, r: any, c: () => string) => <p {...attrs} ref={r} title={c()}>t</p>;`);
  assert.match(
    r.code,
    /__rivet_ref\(_el\$1, r\);\s*__rivet_spread\(_el\$1, attrs, 2, null, "title ref"\);\s*__rivet_attrs\(_el\$1, \(\) => \[c\(\)\], "title"\);/,
  );
  assert.doesNotMatch(r.code, /"ref": void 0/);
  // `class:` / `style:` directives merge into the object as before.
  const directives = dom(`export const view = (attrs: any, on: () => boolean) => <p {...attrs} title="t" class:on={on()}>t</p>;`);
  assert.doesNotMatch(directives.code, /__rivet_attrs/);
  assert.match(directives.code, /"title": "t"/);
  // select / textarea: control lowering, unchanged.
  const controls = dom(
    `export const view = (attrs: any, v: () => string) => <div><select {...attrs} name={v()}><option>1</option></select><textarea {...attrs} name={v()} /></div>;`,
  );
  assert.doesNotMatch(controls.code, /__rivet_attrs/);
  // A trailing `children` attribute stays the spread content.
  const kids = dom(`export const view = (attrs: any, k: () => string) => <p {...attrs} children={k()} title={k()} />;`);
  assert.match(kids.code, /__rivet_spread\(_el\$1, \(\) => \(\{\s*\.\.\.attrs,\s*"children": k\(\)\s*\}\), 1, null, "title"\);/);
  // Repeated trailing names: the last one wins (HTML case-insensitive).
  const twice = dom(`export const view = (attrs: any, k: () => string) => <p {...attrs} title="a" Title={k()}>t</p>;`);
  assert.match(twice.code, /__rivet_attrs\(_el\$1, \(\) => \[k\(\)\], "Title"\);/);
  assert.ok(twice.code.includes('__rivet_tpl("<p>t")'), twice.code);
});

test("F1: server output and spread checks are unchanged", () => {
  const source = `export const view = (attrs: any, id: () => string) => <a class="a" {...attrs} href={id()} disabled>x</a>;`;
  assert.match(server(source).code, /__rivetSpreadAttributes\(\{\s*"class": "a",\s*\.\.\.attrs,\s*"href": id\(\),\s*"disabled": true\s*\}, "a"\)/);
  // Static trailing values keep their compile-time checks (one diagnostic, not two).
  const bad = dom(`export const view = (attrs: any) => <a {...attrs} href="javascript:x" innerHTML="y">x</a>;`);
  assert.equal(bad.diagnostics.length, 2);
});

test("F3: a live member prop of a local becomes `_pm` (static-resolved from a props object at creation); others stay getters", () => {
  const r = dom(
    `import { splitProps } from "@rivetjs/runtime/props";
function Inner(p: any) { return <i>{p.children}</i>; }
export function Outer(props: any) {
  const [local, rest] = splitProps(props, ["slot", "children"]);
  return <Inner slot={local.slot} label={props.label()} {...rest}>{local.children}</Inner>;
}`,
  );
  assert.deepEqual(r.diagnostics, []);
  assert.match(r.code, /import \{[^}]*_pm as __rivetPropsMember[^}]*\} from "@rivetjs\/runtime\/props"/);
  // `local.slot`: `_pm` with the getter index as the fallback; `props.label()` (a call) stays a getter.
  assert.match(r.code, /__rivetPropsMember\(o, "slot", 0, a0, "slot"\);\s*__rivetPropsGetter\(o, "label", 1\);/);
  // `{local.children}` as the only child.
  assert.match(r.code, /__rivetPropsMember\(o, "children", 0, a0, "children"\);/);
  assert.match(r.code, /__rivetProps\d+\(\(\) => local\.children, local\)/);
  // A reassigned local or an optional member stays a getter.
  const kept = dom(`function Inner(p: any) { return <i>{p.a}</i>; }
export function Outer(props: any) { let o = props; o = { ...o }; return <Inner a={o.a} b={props?.b} />; }`);
  assert.doesNotMatch(kept.code, /__rivetPropsMember/);
  // Resume (derived model): nothing is captured, the DOM target static-resolves the member like a plain compile.
  const source = `import { splitProps } from "@rivetjs/runtime/props";
function Inner(p: any) { return <i>{p.slot}</i>; }
export function Outer(props: any) { const [local] = splitProps(props, ["slot"]); return <Inner slot={local.slot} />; }`;
  assert.match(compile(source, { target: "dom", filename: "m.tsx", resume: { module: "m.tsx" } }).code, /__rivetPropsMember/);
});
