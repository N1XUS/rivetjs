// Derived model, DOM target (M2 C3, plan docs/design/plans/2026-10-18-derived-client.md, spec
// docs/design/specs/2026-10-18-structural-resume-design.md §3.5 "As built"): under `resume: { model: "derived" }` the DOM
// target is plain DOM output plus, per boundary (the server target's plan: same set, same names), the body wrapped
// `return _b("<module>#Name", () => …)` and keyed state `_sig` / `_sigStore` with the server's keys; nothing else — the
// runtime (`@rivetjs/runtime/dom-derived`) adopts by walking the same templates (no `_adoptRoot` / `_fxLazy` / `_defer`).
// The runtime end-to-end proof is libs/runtime/tests/derived-adopt-browser.test.ts (last case: both targets compiled).
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import { check, compile, hasDerivedModel, type CompileResult } from "../index.ts";

const it = (name: string, fn: () => void) => (hasDerivedModel() ? test(name, fn) : test.skip(name + " — wasm without the derived model", fn));
const fixture = (name: string) => readFileSync(new URL("../../runtime/tests/derived/" + name, import.meta.url), "utf8");
const PAGE = fixture("page.tsx");
const RESUME = { module: "src/page.tsx", model: "derived", boundaries: ["App", "Header", "Counter"], independent: ["App", "Counter"] };
const derived = (source: string, target: "dom" | "server", resume: object = RESUME): CompileResult =>
  compile(source, { target, filename: "page.tsx", resume } as never);
const plain = (source: string): CompileResult => compile(source, { target: "dom", filename: "page.tsx" });
/** First string argument of every `callee(` call, in order. */
const args = (code: string, callee: string) => [...code.matchAll(new RegExp(callee.replace(/\$/g, "\\$") + '\\("([^"]*)"', "g"))].map((m) => m[1]!);
/** The binding / structure calls and hoisted templates / writers of a DOM module (what the adopt walk replays). */
const walk = (code: string) =>
  code
    .split("\n")
    .map((line) => line.trim())
    .filter((line) =>
      /^(const __rivet(Tpl|Fx)\d+ =|__rivet_(on|insert|fx1|for|show|c|tx|textValue|attrSet)\(|"(each|by|when|fallback)":|children:)/.test(line),
    );
const minified = (code: string) => transformSync(code, { loader: "js", minifyWhitespace: true, minifySyntax: true }).code;

it("adopt mode: one DOM function per component — the body wrapped in _b, the template clone and walk unchanged (the runtime adopts)", () => {
  const out = derived(PAGE, "dom");
  assert.deepEqual(out.diagnostics, []);
  assert.match(out.code, /export function Header\(\) \{\n\s*return __rivetR_b\("src\/page\.tsx#Header", \(\) => \{\n\s*const open = /);
  assert.match(out.code, /import \{ _b as __rivetR_b, _sig as __rivetR_sig \} from "@rivetjs\/runtime\/dom-derived";/);
  // No second compile output: no symbols, no symbol-module exports, the same `_tpl` templates as a plain DOM compile.
  assert.equal(out.symbols, undefined);
  assert.equal(out.scope, undefined);
  assert.deepEqual(out.boundaries, ["src/page.tsx#Header", "src/page.tsx#Counter", "src/page.tsx#App"]);
  assert.deepEqual(walk(out.code), walk(plain(PAGE).code));
  // The hand-lowered fixture (`page.dom.tsx`, plain DOM target) is the expected shape, modulo names, keys and formatting.
  const keys = args(out.code, "__rivetR_sig");
  let k = 0;
  const hand = fixture("page.dom.tsx")
    .replace(/_b\("(\w+)"/g, '_b("src/page.tsx#$1"')
    .replace(/_sig\("[^"]+"/g, () => '_sig("' + keys[k++] + '"');
  const strip = (code: string) => minified(code.replace(/^import .*\n/gm, "").replace(/__rivetR_(b|sig)\b/g, "_$1"));
  assert.equal(strip(out.code), strip(plain(hand).code));
  // Concise arrows, directives, async bodies.
  const shapes = derived(
    `
import { signal } from "@rivetjs/reactivity";
export const Arrow = () => <i onClick={() => {}}>go</i>;
export function Strict() { "use strict"; const n = signal(0); return <b onClick={() => n.set(1)}>{n()}</b>; }
export async function Later() { const n = signal(1); return <u onClick={() => n.set(2)}>{n()}</u>; }
`,
    "dom",
    { module: "src/s.tsx", model: "derived" },
  );
  assert.deepEqual(shapes.diagnostics, []);
  assert.match(shapes.code, /export const Arrow = \(\) => __rivetR_b\("src\/s\.tsx#Arrow", \(\) => \{/);
  assert.match(shapes.code, /"use strict";\n\s*return __rivetR_b\("src\/s\.tsx#Strict", \(\) => \{/);
  assert.match(shapes.code, /return __rivetR_b\("src\/s\.tsx#Later", async \(\) => \{/);
});

it("keyed state on the DOM target: signal(x) → _sig(key, x) / createStore(x) → _sigStore(key, x), keys identical to the server target", () => {
  const source = `
import { signal } from "@rivetjs/reactivity";
import { createStore } from "@rivetjs/reactivity/store";
const shared = signal(0);
function useToggle() { return signal(false); }
export function Panel(props) {
  const open = useToggle();
  const items = createStore({ list: [] });
  const n = signal(props.start, { equals: false });
  return <section onClick={() => { const local = signal(1); open.set(!open()); }}>{n()}{items.list.length}{shared()}</section>;
}
`;
  const resume = { module: "src/panel.tsx", model: "derived" };
  const dom = derived(source, "dom", resume),
    server = derived(source, "server", resume);
  assert.deepEqual(dom.diagnostics, []);
  assert.deepEqual(server.diagnostics, []);
  const domKeys = [...args(dom.code, "__rivetR_sig"), ...args(dom.code, "__rivetR_sigStore")];
  const serverKeys = [...args(server.code, "__rivetR_sig"), ...args(server.code, "__rivetR_sigStore")];
  assert.equal(domKeys.length, 3);
  assert.deepEqual(domKeys, serverKeys);
  assert.match(dom.code, /__rivetR_sigStore\("[0-9a-z]{5}-1", \{ list: \[\] \}\)/);
  assert.match(dom.code, /__rivetR_sig\("[0-9a-z]{5}-2", props\.start, \{ equals: false \}\)/);
  // Module-level state and handler-local state are not keyed (as on the server).
  assert.match(dom.code, /const shared = signal\(0\);/);
  assert.match(dom.code, /const local = signal\(1\);/);
  assert.match(dom.code, /import \{ _b as __rivetR_b, _sig as __rivetR_sig, _sigStore as __rivetR_sigStore \} from "@rivetjs\/runtime\/dom-derived";/);
});

it("static-dep bindings: no _fxLazy — bindings stay today's _fx1 writers (the runtime adopts by the probe / align walk)", () => {
  const out = derived(PAGE, "dom");
  assert.ok(!out.code.includes("_fxLazy"));
  assert.match(out.code, /__rivet_fx1\(__rivetFx\d+, _el\$\d+, n\);/);
  assert.match(out.code, /__rivet_fx1\(__rivetFx\d+, _el\$\d+, theme\);/);
});

it("other bindings evaluate once on adoption: the binding code is the plain DOM target's, byte for byte", () => {
  const out = derived(PAGE, "dom");
  const bindings = (code: string) => walk(code).filter((line) => /^(const __rivetFx|__rivet_(fx1|insert)\()/.test(line));
  assert.ok(bindings(out.code).length >= 5);
  assert.deepEqual(bindings(out.code), bindings(plain(PAGE).code));
});

it("content slots: every <!--[-->…<!--]--> pair the server writes sits where the DOM template has its <!> slot marker", () => {
  const dom = derived(PAGE, "dom"),
    server = derived(PAGE, "server");
  // `<h1>{title} ({n} rows)</h1>`: two mixed-content slots — two server pairs, two template markers, same order.
  assert.match(server.code, /<h1 id=\\"title\\"><!--\[-->",\s*"<!--\]--> \(<!--\[-->",\s*"<!--\]--> rows\)<\/h1>/);
  assert.match(dom.code, /<h1 id=title><!> \(<!> rows\)<\/h1>/);
  // A sole dynamic text child: no server markers, a `" "` placeholder text node in the template (`_tx` writes it).
  assert.match(server.code, /<span id=\\"count\\">",\s*"<\/span>/);
  assert.match(dom.code, /<span id=count> <\/span>/);
  // Structural slots (component children of <main>): pairs on the server, `<!>` markers + `_insert` anchors on the DOM.
  assert.match(dom.code, /__rivet_insert\(_el\$\d+, __rivet_c\(Header, \{\}\), _el\$\d+\);/);
});

it("For: the row function and its bindings are today's (adopted by markers through the runtime's _adoption.list hook)", () => {
  const out = derived(PAGE, "dom");
  assert.match(
    out.code,
    /__rivet_textValue\(_el\$\d+, __rivet_for\(\{\n\s*"each": \(\) => props\.data\.rows,\n\s*"by": \(row\) => row\.id,\n\s*children: \(row\) => \{/,
  );
  // Rows are not boundaries: no `_b` inside the row function.
  assert.equal(out.code.match(/__rivetR_b\(/g)?.length, 3);
});

it("Show / Switch: the branch condition and slots are today's (the runtime adopts the server branch by node identity)", () => {
  const out = derived(PAGE, "dom");
  assert.match(out.code, /__rivet_insert\(_el\$\d+, __rivet_c\(__rivet_show, \{\n\s*"when": \(\) => open\(\),/);
  const TABS = `
import { signal } from "@rivetjs/reactivity";
import { Switch, Match } from "@rivetjs/runtime/dom";
export function Tabs() { const tab = signal(0); return <div onClick={() => tab.set(1)}><Switch><Match when={() => tab() === 0}><p>a</p></Match><Match when={() => tab() === 1}><p>b</p></Match></Switch></div>; }
`;
  const switched = derived(TABS, "dom", { module: "src/tabs.tsx", model: "derived" });
  assert.deepEqual(switched.diagnostics, []);
  assert.match(switched.code, /__rivetR_b\("src\/tabs\.tsx#Tabs", \(\) => \{/);
  // Everything inside the wrapper (Switch / Match calls included) is the plain DOM target's text.
  const inner = (code: string) =>
    code
      .slice(code.indexOf("const tab"), code.lastIndexOf("return _el$"))
      .split("\n")
      .map((line) => line.trim());
  assert.deepEqual(inner(switched.code.replace(/__rivetR_sig\("[^"]+", /, "signal(")), inner(plain(TABS).code));
});

it("component calls: dependent and independent children are both plain _c(Child, props); independence is the server record's flag", () => {
  const dom = derived(PAGE, "dom"),
    server = derived(PAGE, "server");
  // Counter is independent (server `_rB(…, 3, props)`), Header dependent (`_rB(…, 2)`): the DOM calls look the same — the
  // runtime defers by the record flags (no `_defer`).
  assert.match(server.code, /__rivetR_b\("src\/page\.tsx#Counter", 3, props\)/);
  assert.match(server.code, /__rivetR_b\("src\/page\.tsx#Header", 2\)/);
  assert.match(dom.code, /__rivet_c\(Counter, \{ "start": 5 \}\)/);
  assert.match(dom.code, /__rivet_c\(Header, \{\}\)/);
  assert.ok(!dom.code.includes("_defer"));
});

it("serialized model and plain DOM compiles stay byte-identical (parity, zero-cost); diagnostics are the server pass's", () => {
  const resume = { module: "src/page.tsx" };
  assert.deepEqual(derived(PAGE, "dom", { ...resume, model: "serialized" }), derived(PAGE, "dom", resume));
  // A derived module without boundaries is the plain DOM target's output.
  const STATIC = `export function Card() { return <article><h2>Static</h2></article>; }\n`;
  const none = derived(STATIC, "dom", { module: "src/card.tsx", model: "derived" });
  assert.deepEqual(none, plain(STATIC));
  // RV2103 / RV2104 come from the server target only (`check` merges both; DOM adds none, and no serialized-resume code).
  const source = `
import { signal } from "@rivetjs/reactivity";
export function C(props) { const n = props.a ? signal(1) : null; const t = Date.now(); return <b onClick={() => n?.set(1)}>{t}</b>; }
`;
  assert.deepEqual(derived(source, "dom", { module: "src/c.tsx", model: "derived" }).diagnostics, []);
  const checked = check(source, { filename: "c.tsx", resume: { module: "src/c.tsx", model: "derived" } } as never);
  assert.deepEqual(
    checked.diagnostics.map((d) => [d.code, d.targets]),
    [
      ["RV2103", ["server"]],
      ["RV2104", ["server"]],
    ],
  );
});
