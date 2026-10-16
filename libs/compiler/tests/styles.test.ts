import { test } from "vitest";
import assert from "node:assert/strict";
import { compile, type CompileOptions } from "../index.ts";
import { scopedName } from "../styles.ts";

const scope = "src/card.tsx";
const styled = (source: string, options: CompileOptions = {}) =>
  compile(source, { target: "server", filename: "card.tsx", styles: { scope }, ...options });
const block = (css: string, options?: CompileOptions) => {
  const result = styled(`import { css } from "@rivetjs/runtime/css";\nexport const s = css\`${css}\`;\n`, options);
  assert.deepEqual(result.diagnostics, []);
  return result;
};
const n = (local: string) => scopedName(scope, local, "readable");

test("css`` rewrites class selectors, keyframes and animation names; leaves the rest", () => {
  const cases: [string, string][] = [
    [".card{padding:1rem}", `.${n("card")}{padding:1rem}`],
    [".a.b > .c:hover, .d{}", `.${n("a")}.${n("b")} > .${n("c")}:hover, .${n("d")}{}`],
    ["a[href$='.pdf'] .x{}", `a[href$='.pdf'] .${n("x")}{}`],
    ['.x::after{content:".y"}', `.${n("x")}::after{content:".y"}`],
    ["/* .no */.x{background:url(a.b.png);margin:.5em}", `/* .no */.${n("x")}{background:url(a.b.png);margin:.5em}`],
    [":global(.dark) .x{}", `.dark .${n("x")}{}`],
    [":local(.x) .y{}", `.${n("x")} .${n("y")}{}`],
    [".x:is(.y, :not(.z)):has(> .w){}", `.${n("x")}:is(.${n("y")}, :not(.${n("z")})):has(> .${n("w")}){}`],
    ["@media (width >= 48rem){.x{padding:0}}", `@media (width >= 48rem){.${n("x")}{padding:0}}`],
    ["@supports (display:grid){.x{}}", `@supports (display:grid){.${n("x")}{}}`],
    ["@container card (min-width: 20rem){.x{}}", `@container card (min-width: 20rem){.${n("x")}{}}`],
    [".x{color:red;&:hover{color:blue}.y &{} @media print{display:none}}", `.${n("x")}{color:red;&:hover{color:blue}.${n("y")} &{} @media print{display:none}}`],
    ["@keyframes pulse{50%{opacity:.5}}.x{animation:pulse 1s infinite}", `@keyframes ${n("pulse")}{50%{opacity:.5}}.${n("x")}{animation:${n("pulse")} 1s infinite}`],
    [".x{animation-name:other}", `.${n("x")}{animation-name:other}`],
    ["@font-face{font-family:A;src:url(a.woff2)}", "@font-face{font-family:A;src:url(a.woff2)}"],
    [".x{@apply tracking-tight;}", `.${n("x")}{@apply tracking-tight;}`],
    [".-x, .--y, ._z{}", `.${n("-x")}, .${n("--y")}, .${n("_z")}{}`],
    [".é{}", `.${n("é")}{}`],
  ];
  for (const [input, output] of cases) assert.equal(block(input, { styles: { scope, layer: false } }).css, output, input);
});

test("css`` output: layer wrapper, hoisted imports, short names, class maps", () => {
  assert.equal(block(".x{}").css, `@layer components{.${n("x")}{}}`);
  assert.equal(block(".x{}", { styles: { scope, layer: "ui" } }).css, `@layer ui{.${n("x")}{}}`);
  assert.equal(block('@import "a.css";.x{}').css, `@import "a.css";@layer components{.${n("x")}{}}`);
  const short = block(".card{}", { styles: { scope, names: "short" } });
  assert.match(short.css!, /^@layer components\{\.r[0-9a-z]{6}\{\}\}$/);
  assert.equal(scopedName(scope, "card", "short"), short.css!.slice(19, 26));
  assert.deepEqual(block(".a{}.b{}@keyframes k{}").cssClasses, { s: { a: n("a"), b: n("b"), k: n("k") } });
  // Names depend on scope + local only, never on CSS text.
  assert.equal(block(".card{color:red}").cssClasses!.s!.card, block(".card{color:blue}").cssClasses!.s!.card);
  assert.notEqual(n("card"), scopedName("src/other.tsx", "card", "readable"));
});

test("class lookups fold into static fragments, byte-equal to hand-written class strings", () => {
  const head = `import { css, cx } from "@rivetjs/runtime/css";\nconst s = css\`.card{} .title{} .busy{}\`;\n`;
  const body = (card: string, title: string) =>
    `export function Card(props: { title: string; busy?: boolean }) {\n  return <article class=${card}><h2 class=${title}>{props.title}</h2><Child label={s.busy} /></article>;\n}\nfunction Child(props: { label: string }) { return <i>{props.label}</i>; }\n`;
  for (const target of ["server", "dom"] as const) {
    const folded = styled(head + body("{s.card}", "{`${s.title} text-lg`}"), { target });
    assert.deepEqual(folded.diagnostics, []);
    const plain = compile(body(`"${n("card")}"`, `"${n("title")} text-lg"`).replace("{s.busy}", `{"${n("busy")}"}`), { target, filename: "card.tsx" });
    const strip = (code: string) => code.replace(/^const s = [^;]*;\n/m, "").replace(/^import \{ cx \} from "@rivetjs\/runtime\/css";\n/m, "");
    assert.equal(strip(folded.code), plain.code, target);
  }
  const dynamic = styled(head + "export const X = (p: { on: boolean }) => <p class={cx(p.on && s.busy)} data-k={s[p.on ? 'card' : 'title']}>x</p>;\n");
  assert.deepEqual(dynamic.diagnostics, []);
  assert.match(dynamic.code, new RegExp(`cx\\(p\\.on && "${n("busy")}"\\)`));
  assert.match(dynamic.code, /Object\.freeze\(\{/);
});

test("css`` diagnostics", () => {
  const imp = `import { css } from "@rivetjs/runtime/css";\n`;
  const message = (source: string) => styled(imp + source).diagnostics.map((d) => d.message).join("\n");
  assert.match(message("const s = css`.a{}`; export const x = s.b;"), /Unknown class 'b' in css`` block s/);
  assert.match(message("const c = 'x'; const s = css`.a{color:${c}}`;"), /interpolations are not supported/);
  assert.match(message("export function f() { const s = css`.a{}`; return s; }"), /must initialize a top-level const/);
  assert.match(message("let s = css`.a{}`;"), /must initialize a top-level const/);
  assert.match(message("const s = css`.a{}`; s.a = 'x';"), /read-only/);
  assert.match(message("const s = css`:global .a{}`;"), /bare :global/);
  assert.match(message("const s = css`.a{`;"), /unclosed block/);
  assert.match(message("export const X = () => <style>{''}</style>;"), /use css`` from @rivetjs\/runtime\/css/);
});

test("feature off and unrelated modules compile byte-identically", () => {
  const plain = 'export const X = (p: { c: string }) => <p class={p.c} title={"t"}>x</p>;\n';
  assert.equal(styled(plain).code, compile(plain, { target: "server", filename: "card.tsx" }).code);
  assert.equal(styled(plain, { target: "dom" }).code, compile(plain, { target: "dom", filename: "card.tsx" }).code);
  assert.equal(styled(plain).css, undefined);
  // Without the option css`` is left alone (the runtime marker throws).
  const source = 'import { css } from "@rivetjs/runtime/css";\nconst s = css`.a{}`;\nexport const X = () => <p class={s.a}>x</p>;\n';
  const off = compile(source, { target: "server", filename: "card.tsx" });
  assert.match(off.code, /css`\.a\{\}`/);
  assert.equal(off.css, undefined);
  // A local `css` shadowing nothing imported is not a block.
  const local = styled("const css = (s: TemplateStringsArray) => s.raw[0];\nexport const v = css`.a{}`;\n");
  assert.deepEqual(local.diagnostics, []);
  assert.equal(local.css, undefined);
});

test("resume mode keeps folded classes and the frozen map", () => {
  const source =
    'import { css } from "@rivetjs/runtime/css";\nimport { signal } from "@rivetjs/reactivity";\nconst s = css`.on{} .off{}`;\n' +
    "export function Toggle() {\n  const on = signal(false);\n  return <button class={s.off} onClick={() => on.set(!on())} data-on={() => (on() ? s.on : s.off)}>t</button>;\n}\n";
  for (const target of ["server", "dom"] as const) {
    const result = styled(source, { target, resume: { module: scope } });
    assert.deepEqual(result.diagnostics, []);
    // Server: escaped markup string; DOM: compact (unquoted) `_tpl` attribute (C12).
    assert.ok(result.code.includes(target === "server" ? `class=\\"${n("off")}\\"` : `__rivet_tpl("<button class=${n("off")}>t")`), target);
    assert.ok(result.code.includes(`"off": "${n("off")}"`), target); // the frozen map
  }
});
