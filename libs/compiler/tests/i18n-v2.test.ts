// i18n on DOM v2 (docs/design/specs/2026-10-06-dom-v2-only-design.md §2.5, lane V2-I18N): modules with
// `t()` calls lower through v2 (`rust/src/compile/dom_v2_i18n.rs`). Shape tests pin the v2 output (static
// text in the `_tpl` HTML, params / formatters inserted, tag markup inline, case / value templates on
// `_tpl`); mount tests render the module in happy-dom and check the DOM after each signal write (the
// v1 ⇄ v2 parity these replaced went away with the v1 lowering).
import { test } from "vitest";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { compile, registerTable, type CompileOptions } from "../index.ts";
import { buildTable } from "../../i18n/catalog.ts";
import { normalizedHTML } from "../../testing/html.ts";

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
      lead: "<b>{name} leads</b> the <link><i>{name}</i> way</link>",
      odd: "x\uE002y <b>{name}\uE002</b>",
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
      lead: "Der <link><i>{name}</i> Weg</link>: <b>{name} führt</b>",
      odd: "x\uE002y <b>{name}\uE002</b>",
    },
  },
);
registerTable("test-v2", table);
const staticCalls = [{ id: "test-v2", module: "@rivetjs/i18n", export: "t", prefixLookup: true }];
const options = (variant = 1): CompileOptions => ({ target: "dom", filename: "m.tsx", staticCalls, variants: ["en", "de"], variant });
const header = `import { t } from "@rivetjs/i18n";\nimport { signal } from "@rivetjs/reactivity";\n`;
const build = (source: string, variant = 1) => {
  const r = compile(header + source, options(variant));
  assert.deepEqual(r.diagnostics, [], source);
  return r.code;
};
/** v2 output: `_tpl` templates. */
const v2Only = (code: string) => {
  assert.match(code, /__rivet_tpl\(/, code);
};

const runtime = new URL("../../runtime/dom.ts", import.meta.url).href;
const reactivity = import.meta.resolve("@rivetjs/reactivity");
const i18nRuntime = new URL("../../i18n/runtime.ts", import.meta.url).href;
const window = new Window({ url: "http://localhost/" });
Object.assign(globalThis, { document: window.document, window });
const load = (code: string, tag: string) =>
  import(
    "data:text/javascript;base64," +
      Buffer.from(
        code
          .replaceAll('"@rivetjs/runtime/dom"', JSON.stringify(runtime))
          .replaceAll('"@rivetjs/runtime/props"', JSON.stringify(new URL("../../runtime/props.ts", import.meta.url).href))
          .replaceAll('"@rivetjs/reactivity"', JSON.stringify(reactivity))
          .replaceAll('"@rivetjs/i18n/runtime"', JSON.stringify(i18nRuntime)) + `\n// ${tag}`,
      ).toString("base64")
  );
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

let runs = 0;
/**
 * Mount `App` from `source`, run `steps` (signal writes) and return the normalized DOM after mount and
 * after every step; disposal must empty the host.
 */
async function mounted(source: string, steps: ((mod: Record<string, any>) => void)[], variant = 1): Promise<string[]> {
  const mod = await load(build(source, variant), `${variant}-${runs++}`);
  const { mount } = await import(runtime);
  const host = window.document.createElement("div");
  window.document.body.append(host);
  const dispose = mount(() => mod.App(), host);
  const snapshots = [normalizedHTML(host as unknown as Node)];
  for (const step of steps) {
    step(mod);
    await tick();
    snapshots.push(normalizedHTML(host as unknown as Node));
  }
  dispose();
  assert.equal(host.innerHTML, "", "disposed");
  host.remove();
  return snapshots;
}

// ---- shape (needs the V2-I18N wasm) ----

test("v2: static messages are template text, params insert", () => {
  const code = build(`export const A = (p) => <p title={t("hello")} aria-label={t("quote")}>{t("hello")} &amp; {t("greet", { name: p.n, age: 3 })}</p>;`);
  v2Only(code);
  // Static messages (child and attributes) join the template; the param is inserted, `age` (a literal) written once.
  assert.ok(code.includes(String.raw`__rivet_tpl("<p title=Hallo aria-label=\"Sag &quot;x&quot; &amp; y\">Hallo &amp; <!> Jahre, ")`), code);
  assert.match(code, /__rivet_insert\(_el\$1, 3, _el\$2\)/);
  assert.match(code, /__rivet_insert\(_el\$1, \(\) => p\.n, null\)/);
  assert.doesNotMatch(code, /Hello|Hi |\bt\(|i18n\/runtime/);
});

test("v2: a static message adds no binding; a sole formatter child is one text effect", () => {
  const plain = build(`export const A = () => <p>{t("hello")}</p>;`);
  v2Only(plain);
  assert.ok(plain.includes(`__rivet_tpl("<p>Hallo")`), plain);
  assert.doesNotMatch(plain, /__rivet_insert|__rivet_fx/);
  const count = build(`export const A = (p) => <p>{t("items", { count: p.n })}</p>;`);
  v2Only(count);
  assert.match(count, /__rivet_fx\(\(\) => \{\s*try \{\s*__rivet_t\(_el\$1, __i18nPlural\("de", \(?p\.n/);
});

test("v2: tag markup is inline template HTML; its params insert inside the tag", () => {
  const code = build(`export const A = (p) => <p>{t("lead", { name: p.n, link: (c) => <a href="/w">{c}</a> })}</p>;`);
  v2Only(code);
  // `{name}` alone in <i>: a sole-child text effect; `{name}` before " führt": inserted at a marker.
  assert.ok(code.includes(String.raw`__rivet_tpl("<p>Der <a href=\"/w\"><i></i> Weg</a>: <b><!> führt")`), code);
  assert.equal((code.match(/__rivet_insert\(/g) ?? []).length, 1, code);
  assert.match(code, /__rivet_t\(_el\$\d+, p\.n\)/);
});

test("v2: tags inside plural / select cases and rich value positions build _tpl templates", () => {
  const cases = build(`export const A = (p) => <p>{t("cart", { n: p.n, who: p.who, link: (c) => <a href="/cart">{c}</a> })}{t("wrote", { g: p.g })}</p>;`);
  v2Only(cases);
  assert.match(cases, /"=0": \(\) => "Leer"/);
  // Several nodes: a fragment template (flag 4) returned as a node array.
  assert.ok(cases.includes(String.raw`__rivet_tpl("<a href=\"/cart\">Korb von </a>: <b></b> Dinge", 4)`), cases);
  assert.match(cases, /Array\.from\(_el\$\d+\.childNodes\)/);
  const values = build(
    `const Alert = (p) => <div role="alert">{p.message}</div>;
     export const Var = () => { const m = t("terms", { link: (c) => <a href="/terms">{c}</a> }); return <p>{m}</p>; };
     export const Prop = (n) => <Alert message={t("hi", { name: n })} />;`,
  );
  v2Only(values);
  assert.ok(values.includes(String.raw`__rivet_tpl("Lies <a href=\"/terms\">AGB</a> und <b>mehr</b>", 4)`), values);
  assert.ok(values.includes(String.raw`__rivet_tpl("Hallo <b></b>!", 4)`), values);
});

test("v2: static-argument t() needs no accessor in fragments / component props; a lone formatter value builds no template", () => {
  const code = build(
    `const Alert = (p) => <div>{p.message}</div>;
     export const A = () => <>{t("hello")} {t("terms", { link: (c) => <a>{c}</a> })}</>;
     export const B = () => <Alert message={t("hello")} />;
     export const C = (p) => { const m = t("cart", { n: p.n, who: "x", link: (c) => <i>{c}</i> }); return <p>{m}</p>; };`,
  );
  v2Only(code);
  assert.doesNotMatch(code, /__rivet_scoped|__rivet_cp\(/, code);
  assert.match(code, /__rivet_c\(Alert, \{ "message": "Hallo" \}\)/);
  assert.doesNotMatch(code, /__rivet_tpl\("<!>"/, code);
});

// ---- mounted across signal writes ----

const page = `export const n = signal(0), who = signal("<Ann>"), name = signal("Bo"), g = signal("f"), key = signal("home"), loc = signal("de");
export const App = () => (
  <div>
    <p title={t("hello")} aria-label={t("greet", { name: name(), age: n() })} class={t("hello")}>{t("hello")} &amp; {t("quote")}</p>
    <p>A {t("greet", { name: name(), age: 3 })} <b>x</b> {t("items", { count: n() })} z</p>
    <p>{t("items", { count: n() })}</p>
    <p>{t("price", { amount: n() })}</p>
    <p>{t("terms", { link: (c) => <a href="/terms" class="x">{c}</a> })}</p>
    <p>{t("cart", { n: n(), who: who(), link: (c) => <a href="/cart">{c}</a> })}</p>
    <p>{t("wrote", { g: g() })}</p>
    <p>{t("hi", { name: name() })}</p>
    <p>{t("lead", { name: name(), link: (c) => <a href="/w">{c}</a> })}</p>
    <nav title={t(\`nav.\${key()}\`)}>{t(\`nav.\${key()}\`)}</nav>
    <p>{t.in(loc(), "greet", { name: name(), age: 2 })}</p>
    <svg><text>{t("greet", { name: name(), age: n() })}</text></svg>
    <p>{t("odd", { name: name() })}</p>
  </div>
);`;
const steps: ((m: Record<string, any>) => void)[] = [
  (m) => m.n.set(1),
  (m) => m.who.set("Cy"),
  (m) => m.n.set(1200),
  (m) => m.who.set("<Di>"),
  (m) => m.name.set("Al"),
  (m) => m.g.set("x"),
  (m) => m.key.set("about"),
  (m) => m.loc.set("en"),
  (m) => m.n.set(0),
  (m) => m.g.set("f"),
];

for (const variant of [0, 1]) {
  test(`mounted (${variant ? "de" : "en"}): text, params, plural / number / select, tags, tags in cases, prefix keys, t.in, SVG`, async () => {
    const snapshots = await mounted(page, steps, variant);
    assert.equal(snapshots.length, steps.length + 1);
    if (variant === 1) {
      assert.match(snapshots[0]!, /<p aria-label="0 Jahre, Bo" class="Hallo" title="Hallo">Hallo &amp; Sag "x" &amp; y<\/p>/);
      assert.match(snapshots[3]!, /<a href="\/cart">Korb von Cy<\/a>: <b>1\.200<\/b> Dinge/);
      assert.match(snapshots[3]!, /<p>Kosten 1\.200,00\s€<\/p>/);
      assert.match(snapshots[4]!, /<a href="\/cart">Korb von &lt;Di&gt;<\/a>/);
      assert.match(snapshots[5]!, /Der <a href="\/w"><i>Al<\/i> Weg<\/a>: <b>Al führt<\/b>/);
      assert.match(snapshots[6]!, /<p>Sie schrieben!<\/p>/);
      assert.match(snapshots[7]!, /<nav title="Über">Über<\/nav>/);
      assert.match(snapshots[10]!, /<p><em>Sie<\/em> schrieb!<\/p>/);
    } else {
      assert.match(snapshots[0]!, /<p>A Hi Bo, you are 3 <b>x<\/b> no items z<\/p><p>no items<\/p>/);
      assert.match(snapshots[3]!, /<p><b>1,200<\/b> items in <a href="\/cart">Cy's cart<\/a><\/p>/);
      assert.match(snapshots[5]!, /<p><b>Al leads<\/b> the <a href="\/w"><i>Al<\/i> way<\/a><\/p>/);
      assert.match(snapshots[7]!, /<nav title="About">About<\/nav>/);
      assert.match(snapshots[9]!, /<p>Empty<\/p>/);
    }
    // `t.in(loc(), …)` follows the locale signal; SVG text keeps its namespace.
    assert.match(snapshots[0]!, /<p>2 Jahre, Bo<\/p><svg:svg><svg:text>/);
    assert.match(snapshots[8]!, /<p>Hi Al, you are 2<\/p>/);
  });
}

test("mounted: rich messages as values (variable, prop, return value, conditional re-insert)", async () => {
  const source = `const Alert = (p) => <div role="alert">{p.message}</div>;
const terms = () => t("terms", { link: (c) => <a href="/terms">{c}</a> });
export const on = signal(true), name = signal("Bo"), n = signal(1);
export const App = () => {
  const m = t("terms", { link: (c) => <a href="/terms">{c}</a> });
  const again = t("terms", { link: (c) => <a href="/again">{c}</a> });
  return (
    <section>
      <p>{m}</p>
      <Alert message={t("hi", { name: name() })} />
      <p>{terms()}</p>
      <p>{on() && again}</p>
      <p>{on() ? t("cart", { n: n(), who: name(), link: (c) => <i>{c}</i> }) : "off"}</p>
      <>{t("hello")} {t("wrote", { g: "f" })}</>
    </section>
  );
};`;
  const snapshots = await mounted(source, [
    (m) => m.on.set(false),
    (m) => m.on.set(true),
    (m) => m.n.set(5),
    (m) => m.name.set("Al"),
    (m) => m.on.set(false),
    (m) => m.on.set(true),
  ]);
  assert.match(snapshots[0]!, /<div role="alert">Hallo <b>Bo<\/b>!<\/div>/);
  assert.match(snapshots[1]!, /<p><\/p><p>off<\/p>/);
  assert.match(snapshots[2]!, /<p>Lies <a href="\/again">AGB<\/a> und <b>mehr<\/b><\/p>/);
  assert.match(snapshots[3]!, /<p><i>Korb von Bo<\/i>: <b>5<\/b> Dinge<\/p>/);
  assert.match(snapshots[4]!, /<p><i>Korb von Al<\/i>: <b>5<\/b> Dinge<\/p>/);
  // Re-inserted after a false branch: the same nodes come back.
  assert.equal(snapshots[6], snapshots[4]);
  assert.match(snapshots[6]!, /Hallo <em>Sie<\/em> schrieb!<\/section>/);
});
