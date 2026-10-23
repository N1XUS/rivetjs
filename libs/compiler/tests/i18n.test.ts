import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compile, registerTable, type CompileOptions } from "../index.ts";
import { renderToString } from "../../runtime/server.ts";
import { buildTable } from "../../i18n/catalog.ts";

const { table } = buildTable(
  { locales: ["en", "de"], defaultLocale: "en", catalogs: "unused" },
  {
    en: {
      hello: "Hello",
      greet: "Hi {name}, you are {age}",
      items: "{count, plural, =0 {no items} one {# item} other {# items}}",
      price: "Cost {amount, number, ::currency/EUR}",
      terms: "Read <link>terms</link> and <b>more</b>",
      quote: 'Say "x" & y',
      nav: { home: "Home", about: "About" },
      cart: "{n, plural, =0 {Empty} one {<b>#</b> item} other {<b>#</b> items in <link>{who}'s cart</link>}}",
      wrote: "{g, select, f {<em>She</em> wrote} other {They wrote}}!",
      hi: "Hi <b>{name}</b>!",
    },
    de: {
      hello: "Hallo",
      greet: "{age} Jahre, {name}",
      items: "{count, plural, =0 {keine Dinge} one {# Ding} other {# Dinge}}",
      price: "Kosten {amount, number, ::currency/EUR}",
      terms: "Lies <link>AGB</link> und <b>mehr</b>",
      quote: 'Sag "x" & y',
      nav: { home: "Start", about: "Über" },
      cart: "{n, plural, =0 {Leer} one {<b>#</b> Ding} other {<link>Korb von {who}</link>: <b>#</b> Dinge}}",
      wrote: "{g, select, f {<em>Sie</em> schrieb} other {Sie schrieben}}!",
      hi: "Hallo <b>{name}</b>!",
    },
  },
);
registerTable("test", table);
const staticCalls = [{ id: "test", module: "@rivetjs/i18n", export: "t", prefixLookup: true }];
const options = (extra: CompileOptions = {}): CompileOptions => ({
  target: "server",
  filename: "fixture.tsx",
  staticCalls,
  variants: ["en", "de"],
  ...extra,
});
const header = `import { t } from "@rivetjs/i18n";\n`;

async function execute(source: string, extra: CompileOptions = {}) {
  const result = compile(header + source, options(extra));
  assert.deepEqual(result.diagnostics, []);
  const code = result.code
    .replaceAll('"@rivetjs/runtime/server"', JSON.stringify(new URL("../../runtime/server.ts", import.meta.url).href))
    .replaceAll('"@rivetjs/runtime/slot"', JSON.stringify(new URL("../../runtime/slot.ts", import.meta.url).href))
    .replaceAll('"@rivetjs/i18n/runtime"', JSON.stringify(new URL("../../i18n/runtime.ts", import.meta.url).href));
  return { module: await import("data:text/javascript," + encodeURIComponent(code)), code };
}
const both = async (value: unknown) => [await renderToString(value as never, { variant: 0 }), await renderToString(value as never, { variant: 1 })];
const diagnostics = (source: string, extra: CompileOptions = {}) => compile(header + source, options(extra)).diagnostics.map((d) => d.message);

test("static messages compile into per-variant fragments without message runtime", async () => {
  const { module, code } = await execute(`export const A = () => <p title={t("hello")}>{t("hello")} &amp; {t("quote")}</p>;`);
  assert.deepEqual(await both(module.A), ['<p title="Hello">Hello &amp; Say "x" &amp; y</p>', '<p title="Hallo">Hallo &amp; Sag "x" &amp; y</p>']);
  assert.doesNotMatch(code, /i18n\/runtime|__rivetVariantValue|\bt\(/);
});

test("params are slots written in each locale's word order, evaluated once in source order", async () => {
  const { module } = await execute(
    `export const log = []; const m = (v) => (log.push(v), v);
     export const A = () => <p>{t("greet", { name: m("<Ann>"), age: m(3) })}</p>;`,
  );
  assert.deepEqual(await both(module.A), ["<p>Hi &lt;Ann&gt;, you are 3</p>", "<p>3 Jahre, &lt;Ann&gt;</p>"]);
  assert.deepEqual(module.log, ["<Ann>", 3, "<Ann>", 3]);
});

test("plural, exact cases and number skeletons use the locale's rules", async () => {
  const { module } = await execute(`export const A = (n) => <p>{t("items", { count: n })}|{t("price", { amount: n })}</p>;`);
  const render = (n: number) => both(module.A(n));
  assert.deepEqual(await render(0), ["<p>no items|Cost €0.00</p>", "<p>keine Dinge|Kosten 0,00\u00a0€</p>"]);
  assert.deepEqual(await render(1), ["<p>1 item|Cost €1.00</p>", "<p>1 Ding|Kosten 1,00\u00a0€</p>"]);
  assert.deepEqual(await render(1200), ["<p>1,200 items|Cost €1,200.00</p>", "<p>1.200 Dinge|Kosten 1.200,00\u00a0€</p>"]);
});

test("tags render through params or the allowlist; non-JSX positions are values", async () => {
  const { module } = await execute(
    `export const A = () => <p>{t("terms", { link: (c) => <a href="/terms" class="x">{c}</a> })}</p>;
     export const B = (n) => <p aria-label={t("greet", { name: n, age: 1 })}>{[t("hello")]}</p>;`,
  );
  assert.deepEqual(await both(module.A), [
    '<p>Read <a href="/terms" class="x">terms</a> and <b>more</b></p>',
    '<p>Lies <a href="/terms" class="x">AGB</a> und <b>mehr</b></p>',
  ]);
  assert.deepEqual(await both(module.B('"q"')), ['<p aria-label="Hi &quot;q&quot;, you are 1">Hello</p>', '<p aria-label="1 Jahre, &quot;q&quot;">Hallo</p>']);
});

test("tags inside plural/select cases render per locale (server)", async () => {
  const { module } = await execute(
    `export const A = (n, who) => <p>{t("cart", { n, who, link: (c) => <a href="/cart">{c}</a> })}</p>;
     export const B = (g) => <p>{t("wrote", { g })}</p>;`,
  );
  assert.deepEqual(await both(module.A(0, "x")), ["<p>Empty</p>", "<p>Leer</p>"]);
  assert.deepEqual(await both(module.A(1, "x")), ["<p><b>1</b> item</p>", "<p><b>1</b> Ding</p>"]);
  assert.deepEqual(await both(module.A(1200, "<Ann>")), [
    `<p><b>1,200</b> items in <a href="/cart">&lt;Ann&gt;'s cart</a></p>`,
    `<p><a href="/cart">Korb von &lt;Ann&gt;</a>: <b>1.200</b> Dinge</p>`,
  ]);
  assert.deepEqual(await both(module.B("f")), ["<p><em>She</em> wrote!</p>", "<p><em>Sie</em> schrieb!</p>"]);
  assert.deepEqual(await both(module.B("x")), ["<p>They wrote!</p>", "<p>Sie schrieben!</p>"]);
});

test("tags inside plural/select cases lower to DOM templates (DOM)", () => {
  const source = `export const A = (p) => <p>{t("cart", { n: p.n, who: p.who, link: (c) => <a href="/cart">{c}</a> })}</p>;`;
  const { code, diagnostics: errors } = compile(header + source, options({ target: "dom", variant: 1 }));
  assert.deepEqual(errors, []);
  // Tag cases are templates; the tagless case stays a string.
  assert.match(code, /"=0": \(\) => "Leer"/);
  assert.ok(code.includes(String.raw`__rivet_tpl("<a href=\"/cart\">Korb von </a>: <b></b> Dinge", 4)`), code);
  assert.ok(code.includes(String.raw`__rivet_tpl("<b></b> Ding", 4)`), code);
  assert.doesNotMatch(code, /item|Empty|\bt\(/);
});

test("tags inside cases: resumed bindings render markup; attributes are diagnosed", async () => {
  const source = `import { signal } from "@rivetjs/reactivity";
export default function C() { const n = signal(1); return <button onClick={() => n.set(n() + 1)}>{t("cart", { n: n(), who: "Bo", link: (c) => <i>{c}</i> })}</button>; }`;
  const server = compile(header + source, options({ resume: {} }));
  assert.deepEqual(server.diagnostics, []);
  assert.match(server.code, /__rivetR_b\(/);
  const dom = compile(header + source, options({ target: "dom", variant: 1, resume: {} }));
  assert.deepEqual(dom.diagnostics, []);
  // The boundary's DOM code: the tagged case is a `_tpl` fragment (dom_v2_i18n.rs).
  assert.ok(dom.code.includes(String.raw`__rivet_tpl("<i>Korb von </i>: <b></b> Dinge", 4)`), dom.code);
  assert.doesNotMatch(dom.code, /__rivetSpec|"en"|\bt\(/);
  assert.deepEqual(diagnostics(`export const A = (g) => <p title={t("wrote", { g })} />;`), [attributeTags("<em>", "wrote")]);
});

const attributeTags = (tag: string, key: string) =>
  `Message tags (${tag} in "${key}") are not supported in an attribute: attribute values are strings, and tags need JSX content. Use a message without tags here, or render this one as JSX (children, a prop, a variable)`;
const inTags = (tag: string, key: string) =>
  `Message tags (${tag} in "${key}") are not supported in t.in(): it returns a string, and tags need JSX content. Use t() in JSX (children, a prop, a variable), or a message without tags`;

const richValues = `const Alert = (p) => <div role="alert">{p.message}</div>;
const terms = () => t("terms", { link: (c) => <a href="/terms">{c}</a> });
export const Var = () => { const m = t("terms", { link: (c) => <a href="/terms">{c}</a> }); return <p>{m}</p>; };
export const Prop = (n) => <Alert message={t("hi", { name: n })} />;
export const Ret = () => <p>{terms()}</p>;
export const Cond = (on) => <p>{on && t("terms", { link: (c) => <a href="/terms">{c}</a> })}</p>;`;

test("rich messages are values: variables, props, return values (server)", async () => {
  const { module } = await execute(richValues);
  const terms = ['Read <a href="/terms">terms</a> and <b>more</b>', 'Lies <a href="/terms">AGB</a> und <b>mehr</b>'];
  assert.deepEqual(
    await both(module.Var),
    terms.map((m) => `<p>${m}</p>`),
  );
  assert.deepEqual(await both(module.Prop("<Ann>")), ['<div role="alert">Hi <b>&lt;Ann&gt;</b>!</div>', '<div role="alert">Hallo <b>&lt;Ann&gt;</b>!</div>']);
  assert.deepEqual(
    await both(module.Ret),
    terms.map((m) => `<p>${m}</p>`),
  );
  assert.deepEqual(
    await both(module.Cond(true)),
    terms.map((m) => `<p>${m}</p>`),
  );
  assert.deepEqual(await both(module.Cond(false)), ["<p></p>", "<p></p>"]);
});

test("rich messages are values: DOM templates for the variant", () => {
  const { code, diagnostics: errors } = compile(header + richValues, options({ target: "dom", variant: 1 }));
  assert.deepEqual(errors, []);
  assert.ok(code.includes(String.raw`__rivet_tpl("Lies <a href=\"/terms\">AGB</a> und <b>mehr</b>", 4)`), code);
  assert.ok(code.includes(String.raw`__rivet_tpl("Hallo <b></b>!", 4)`), code);
  assert.doesNotMatch(code, /Read|Hi |\bt\(/);
});

test("rich messages in resumed bindings render markup on the server and in the boundary DOM code", async () => {
  const source = `import { signal } from "@rivetjs/reactivity";
export default function C() { const n = signal("Bo"); return <button onClick={() => n.set("Al")}>{t("hi", { name: n() })}</button>; }`;
  const server = compile(header + source, options({ resume: {} }));
  assert.deepEqual(server.diagnostics, []);
  assert.match(server.code, /__rivetR_b\(/);
  const dom = compile(header + source, options({ target: "dom", variant: 1, resume: {} }));
  assert.deepEqual(dom.diagnostics, []);
  assert.ok(dom.code.includes(String.raw`__rivet_tpl("<button>Hallo <b></b>!")`), dom.code);
  assert.doesNotMatch(dom.code, /__rivetSpec|"en"|Hi |\bt\(/);
});

test("rich messages in attributes and t.in are diagnosed with the reason", () => {
  const link = `{ link: (c) => <a>{c}</a> }`;
  assert.deepEqual(diagnostics(`export const A = () => <p title={t("terms", ${link})} />;`), [attributeTags("<link>", "terms")]);
  assert.deepEqual(diagnostics(`export const A = () => <p title={t("terms", ${link})} />;`, { target: "dom", variant: 0 }), [attributeTags("<link>", "terms")]);
  assert.deepEqual(diagnostics(`export const m = (l) => t.in(l, "terms", ${link});`), [inTags("<link>", "terms")]);
});

test("t.in picks a locale at runtime; translated values throw outside render", async () => {
  const { module } = await execute(`export const mail = (l) => t.in(l, "greet", { name: "Bo", age: 2 }); export const v = t("hello");`);
  assert.equal(module.mail("de"), "2 Jahre, Bo");
  assert.equal(module.mail("fr"), "Hi Bo, you are 2");
  assert.throws(() => String(module.v), /t\.in\(locale, key, params\)/);
});

test("prefixed keys look up a hoisted per-locale table", async () => {
  const { module, code } = await execute(`export const A = (k) => <nav>{t(\`nav.\${k}\`)}</nav>;`);
  assert.deepEqual(await both(module.A("about")), ["<nav>About</nav>", "<nav>Über</nav>"]);
  assert.deepEqual(await both(module.A("toString")), ["<nav></nav>", "<nav></nav>"]);
  assert.doesNotMatch(code, /console\.warn/);
  assert.match(compile(header + `export const A = (k) => <nav>{t(\`nav.\${k}\`)}</nav>;`, options({ dev: true })).code, /console\.warn/);
});

test("DOM target inlines its variant", () => {
  const source = `export const A = (p) => <p title={t("hello")}>{t("greet", { name: p.n, age: p.a })} {t("terms", { link: (c) => <a>{c}</a> })}</p>;`;
  const { code, diagnostics: errors } = compile(header + source, options({ target: "dom", variant: 1 }));
  assert.deepEqual(errors, []);
  // Static text + attribute message in the template; params inserted at their markers in the locale's order.
  assert.match(code, /__rivet_tpl\("<p title=Hallo><!> Jahre, <!> Lies <a>AGB<\/a> und <b>mehr"\)/);
  assert.match(code, /__rivet_insert\(_el\$1, \(\) => p\.a, _el\$2\);\n\t__rivet_insert\(_el\$1, \(\) => p\.n, _el\$3\);/);
  assert.doesNotMatch(code, /Hello|Hi |i18n\/runtime|\bt\(/);
  assert.deepEqual(diagnostics("export const x = t('hello');", { target: "dom" }), ["DOM target with staticCalls requires a variant index"]);
});

test("misuse is diagnosed", () => {
  const cases: [string, string][] = [
    [`t(key)`, "t() key must be a string literal or a prefixed template literal (`prefix.${x}`)"],
    [`t("nope")`, 'Unknown message key "nope"'],
    [`t("greet", { name: 1 })`, 'Missing param "age" for "greet"'],
    [`t("greet", { name: 1, age: 2, extra: 3 })`, 'Unknown param "extra" for "greet"'],
    [`t("greet", params)`, "t() params must be an object literal"],
    [`t("terms")`, 'Tag <link> in "terms" needs a param: t("terms", { link: (c) => <…>{c}</…> })'],
    [`t("terms", { link: (c) => <Link>{c}</Link> })`, "Tag param must be (children) => <jsx>"],
    [`t(\`nav.\${k}\`, { a: 1 })`, "Prefixed keys must not take params"],
    [`t(\`zzz.\${k}\`)`, 'No message keys match prefix "zzz."'],
    [`t.in(l, "terms", { link: (c) => <a>{c}</a> })`, inTags("<link>", "terms")],
  ];
  for (const [call, message] of cases) assert.deepEqual(diagnostics(`export const x = ${call};`), [message], call);
  assert.deepEqual(
    compile(header + "t('x')", { ...options(), staticCalls: [{ ...staticCalls[0]!, id: "missing" }] }).diagnostics.map((d) => d.message),
    ['Static call table "missing" is not registered'],
  );
});

test("unused staticCalls leave every corpus compile byte-identical", () => {
  const lines = readFileSync(new URL("../oracle/corpus.jsonl", import.meta.url), "utf8")
    .split("\n")
    .filter(Boolean);
  let compared = 0;
  for (const line of lines) {
    const entry = JSON.parse(line) as { kind: string; args: [string, CompileOptions?] };
    if (entry.kind !== "compile") continue;
    const [source, base = {}] = entry.args;
    const plain = compile(source, base);
    const hooked = compile(source, { ...base, staticCalls, variants: ["en", "de"], variant: 0 });
    assert.deepEqual(hooked, plain);
    compared++;
  }
  assert.ok(compared > 100);
});

test("resume: static messages stay static fragments; the boundary renders messages reading signals", () => {
  const source = `import { signal } from "@rivetjs/reactivity";
export default function C() { const n = signal(1); return <button onClick={() => n.set(n() + 1)} title={t("hello")}>{t("items", { count: n() })} {t("hello")}</button>; }`;
  const result = compile(header + source, options({ resume: {} }));
  assert.deepEqual(result.diagnostics, []);
  assert.match(result.code, /__rivetR_b\(/);
  assert.match(result.code, /"<button title=\\"Hallo\\""/);
});

test("resume: the boundary DOM code lowers t() for the client variant", () => {
  const source = `import { signal } from "@rivetjs/reactivity";
export default function C() { const n = signal(1); return <button onClick={() => n.set(n() + 1)}>{t("items", { count: n() })}</button>; }`;
  const { code } = compile(header + source, options({ target: "dom", variant: 1, resume: {} }));
  // The binding's import is compiled away.
  assert.doesNotMatch(code, /\bt\b.*from "@rivetjs\/i18n"|export \{ t \}/);
  assert.match(code, /__i18nPlural\("de"/);
  assert.doesNotMatch(code, /"en"|\bt\(/);
});
