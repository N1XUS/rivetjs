// G24: object refs (`ref<T>()`) in resume modules, Suspense children thunks, `sourcePackages`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";

const resume = { module: "m.tsx" };
const both = (source: string, extra: object = {}) =>
  (["server", "dom"] as const).map((target) => compile(source, { target, filename: "m.tsx", resume, ...extra }));
const head = `import { ref } from "@rivetjs/runtime/dom";\n`;

test("resume: ref={object} records the element on the server; the DOM target binds it like a callback", () => {
  const [server, dom] = both(
    head +
      `export function C(props) { const c = ref(); return <div><canvas ref={c} onClick={() => c().focus()} /><input ref={props.inputRef} /><i ref={props.refs[0]} /></div>; }`,
  );
  assert.deepEqual(server.diagnostics, []);
  assert.deepEqual(dom.diagnostics, []);
  assert.match(server.code, /__rivetR_ref\(__rivet_refValue\(c\)\)/);
  assert.match(server.code, /import \{[^}]*_refValue as __rivet_refValue[^}]*\} from "@rivetjs\/runtime\/server"/);
  assert.doesNotMatch(dom.code, /_refValue/);
  assert.match(server.code, /__rivetR_ref\(__rivet_refValue\(props\.inputRef\)\)/);
  assert.match(server.code, /__rivetR_ref\(__rivet_refValue\(props\.refs\[0\]\)\)/);
  // The ref object is a plain capture (serialized by value: element id).
  const click = dom.symbols!.find((s) => s.kind === "event")!;
  assert.deepEqual(click.captures, ["c"]);
  assert.match(dom.code, /__rivet_ref\(_el\$\d+, c\)/);
  assert.match(dom.code, /__rivet_ref\(_el\$\d+, props\.inputRef\)/);
});

test("resume: callback refs keep their ref cells; mixing both forms on one element is fine", () => {
  const [server] = both(
    head + `export function C() { let el; const c = ref(); return <b ref={(x) => (el = x)} onClick={() => el.focus() || c()}><i ref={c} /></b>; }`,
  );
  assert.deepEqual(server.diagnostics, []);
  assert.match(server.code, /el = __rivetR_refCell\(\)/);
  assert.match(server.code, /__rivetR_ref\(el\)/);
  assert.match(server.code, /__rivetR_ref\(__rivet_refValue\(c\)\)/);
});

test("resume: RV2002 stays for callbacks that never run on a resumed page", () => {
  const messages = (source: string) => compile(source, { target: "server", filename: "m.tsx", resume }).diagnostics.map((d) => d.message);
  const callback = /Resumable ref callbacks must assign a local: ref=\{\(el\) => \(local = el\)\}$/;
  assert.ok(messages(`export function C() { return <b ref={(el) => el.focus()}>x</b>; }`).some((m) => callback.test(m)));
  assert.ok(messages(`export function C() { const f = (el) => el.focus(); return <b ref={f}>x</b>; }`).some((m) => callback.test(m)));
  assert.ok(messages(`export function C() { function f(el) { el.focus(); } return <b ref={f}>x</b>; }`).some((m) => callback.test(m)));
  // Not a local callback: an object ref, a prop, a call result.
  assert.deepEqual(
    messages(head + `export function C(p) { const r = ref(); const s = p.r; return <b ref={r}><i ref={p.r} /><u ref={s} /><s ref={p.get()} /></b>; }`),
    [],
  );
});

test("ref objects: unused (no ref attribute) and outside resume modules, output is unchanged", () => {
  const source = head + `export function C(p) { const c = ref(); return <canvas ref={c} />; }`;
  const plain = compile(source, { target: "server", filename: "m.tsx" });
  assert.deepEqual(plain.diagnostics, []);
  assert.doesNotMatch(plain.code, /__rivetR_ref|_refValue/);
  assert.match(plain.code, /__rivetOmitted\(c\)/);
});

test("ref in a spread stays ignored", () => {
  const [server, dom] = both(head + `export function C(p) { const c = ref(); return <canvas {...p} ref={c} />; }`);
  assert.deepEqual(server.diagnostics, []);
  assert.deepEqual(dom.diagnostics, []);
  assert.match(server.code, /__rivetR_ref\(__rivet_refValue\(c\)\)/);
});

test("Suspense children become a thunk on both targets, in every module", () => {
  const source = `import { Suspense } from "@rivetjs/runtime/dom";\nexport function P() { return <Suspense fallback={() => <i>…</i>}><A /><B /></Suspense>; }\nfunction A() { return <a />; }\nfunction B() { return <b />; }`;
  for (const extra of [{}, { resume }])
    for (const target of ["server", "dom"] as const) {
      const out = compile(source, { target, filename: "m.tsx", ...extra });
      assert.deepEqual(out.diagnostics, []);
      assert.match(out.code, /"?children"?: __rivetSlot\(\(\) => /, target + " " + JSON.stringify(extra) + "\n" + out.code);
    }
  // Explicit thunk children stay as they are.
  const explicit = compile(`import { Suspense } from "@rivetjs/runtime/dom";\nexport function P() { return <Suspense>{() => <i />}</Suspense>; }`, {
    target: "dom",
    filename: "m.tsx",
  });
  assert.doesNotMatch(explicit.code, /\(\) => \(\) =>/);
});

test("sourcePackages: components of listed @rivetjs/* packages get symbol callback props; others are framework", () => {
  const source = `import { signal } from "@rivetjs/reactivity";\nimport { Button } from "@rivetjs/cdk/button";\nexport function A() { const n = signal(0); return <><Button onPress={() => n.set(n() + 1)}>+</Button><p>{n()}</p></>; }`;
  const symbol = /"onPress": __rivetR_fn\("m\.tsx#A\$\w+"/;
  const [listed] = both(source, { sourcePackages: ["@rivetjs/cdk"] });
  assert.match(listed.code, symbol);
  const [unlisted] = both(source);
  assert.doesNotMatch(unlisted.code, symbol);
  const [other] = both(source, { sourcePackages: ["@rivetjs/forms"] });
  assert.doesNotMatch(other.code, symbol);
  // Non-@rivetjs packages were always user components.
  const third = source.replace("@rivetjs/cdk/button", "@acme/ui/button");
  assert.match(both(third)[0].code, symbol);
});
