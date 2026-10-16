import { test } from "vitest";
import assert from "node:assert/strict";
import { hotModule } from "../hot.ts";

test("hot modules: exported components become stable wrappers; other exports guard the update", () => {
  const code = [
    'import { signal } from "@rivetjs/reactivity";',
    'export const head = () => ({ title: "x" });',
    "export function Card(props) {",
    "\treturn 1;",
    "}",
    "export const Badge = (props) => 2;",
    "export default function Page() {",
    "\treturn 3;",
    "}",
  ].join("\n");
  const out = hotModule(code, "src/page.tsx")!;
  const lines = out.split("\n");
  // Same lines, same columns: `export` blanked in place (source maps stay valid).
  assert.equal(lines[2], "       function Card(props) {");
  assert.equal(lines[5], "       const Badge = (props) => 2;");
  assert.equal(lines[6], "               function Page() {");
  assert.equal(lines[1], code.split("\n")[1]);
  assert.match(out, /const __rivetHot0 = __rivetHot\(Card, "src\/page\.tsx#Card"\);/);
  assert.match(out, /const __rivetHot2 = __rivetHot\(Page, "src\/page\.tsx#default"\);/);
  assert.match(out, /export \{ __rivetHot0 as Card, __rivetHot1 as Badge, __rivetHot2 as default \};/);
  assert.match(out, /const __rivetValues = \{ head \};/);
  assert.match(
    out,
    /import\.meta\.hot\.accept\(\(next\) => \{ if \(!next \|\| __rivetChanged\(__rivetValues, next, \["Card","Badge","default","head"\]\)\) import\.meta\.hot\.invalidate\(\); \}\);/,
  );
});

test("hot modules: unrecognized exports and component-free modules are left alone", () => {
  assert.equal(hotModule('export { A } from "./x";\nexport function B() {}', "a"), null);
  assert.equal(hotModule('export * from "./x";\nexport function B() {}', "a"), null);
  assert.equal(hotModule("export const value = 1;\nexport function helper() {}", "a"), null);
  assert.match(hotModule("// @refresh reset\nexport function A() {}", "a")!, /__rivetHot\(A, "a#A", true\)/);
  assert.match(hotModule("function A() {}\nexport default A;", "a")!, /export \{ __rivetHot0 as default \};/);
});

test("hot modules: local export lists are values compared on update", () => {
  const out = hotModule("const Widget = make();\nexport default function Layout() {}\nexport { Widget, helper as tool };", "l")!;
  assert.match(out, /const __rivetValues = \{ Widget, tool: helper \};/);
  assert.match(out, /\["default","Widget","tool"\]/);
  assert.equal(hotModule("export { a as default };\nexport function B() {}", "l"), null);
});

test("hot modules: an arrow default export keeps state-keeping HMR (same line width)", () => {
  const code = ["export default (props) => {", "\treturn 1;", "};", "export const Nav = async () => 2;"].join("\n");
  const out = hotModule(code, "src/page.tsx")!;
  assert.ok(out, "arrow default export is hot");
  const lines = out.split("\n");
  assert.equal(lines[0], "let __rivetDef=(props) => {");
  assert.equal(lines[0]!.length, code.split("\n")[0]!.length);
  assert.match(out, /const __rivetHot0 = __rivetHot\(__rivetDef, "src\/page\.tsx#default"\);/);
  assert.match(out, /export \{ __rivetHot0 as default \};/);
  assert.match(hotModule("export default async (p) => 1;", "a")!, /__rivetHot\(__rivetDef, "a#default"\)/);
  assert.match(hotModule("export default p => 1;", "a")!, /__rivetHot\(__rivetDef, "a#default"\)/);
  // Not an arrow: left to normal propagation.
  assert.equal(hotModule("export default (a + b);", "a"), null);
});

test("hot modules (T6): `export ` lines inside template literals, comments and strings are not rewritten", () => {
  const code = [
    "export const sample = `",
    "export const Fake = () => 1;",
    "export { nope };",
    "${`nested",
    "export function Inner() {}`}",
    "`;",
    "/*",
    "export function Commented() {}",
    "*/",
    "const re = /`/;",
    "export function Card() {",
    '\treturn "`";',
    "}",
  ].join("\n");
  const out = hotModule(code, "m")!;
  assert.ok(out);
  const lines = out.split("\n");
  for (const i of [1, 2, 4, 7]) assert.equal(lines[i], code.split("\n")[i], `line ${i} untouched`);
  assert.equal(lines[10], "       function Card() {");
  assert.match(out, /export \{ __rivetHot0 as Card \};/);
  assert.match(out, /const __rivetValues = \{ sample \};/);
});

test("hot modules (T6): several declarators bail; `export let` keeps its live binding", () => {
  assert.equal(hotModule("export const App = () => 1, VERSION = 1;\nexport function B() {}", "m"), null);
  assert.equal(hotModule("export const App = () => {\n\treturn f(1, 2);\n},\n\tVERSION = 1;", "m"), null);
  // Commas inside the initializer are not declarators.
  assert.match(hotModule("export const App = (a, b) => [a, b];", "m")!, /__rivetHot\(App, "m#App"\)/);
  const live = hotModule("export let Live = () => 1;\nexport function Card() {}", "m")!;
  assert.match(live, /^export let Live = \(\) => 1;$/m);
  assert.match(live, /const __rivetValues = \{ Live \};/);
  assert.match(live, /export \{ __rivetHot0 as Card \};/);
});
