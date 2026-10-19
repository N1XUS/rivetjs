// LAZY-ROWS T2 (spec docs/design/specs/2026-10-19-lazy-collection-rows-design.md §3.3, ruling R3): one lazy / recorded
// verdict per keyed `<For>`; a lazy For's row function is a resumable row symbol (`_rFn`) and the server passes the
// compiler-private `$lazy: [flags, key?]`; a recorded For compiles exactly as before (oracle corpus cases 227–236 hold
// HEAD's bytes); RV2105 / RV2106 warnings on row bodies; `forRows` facts in `compile` / `check`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resumableToString, type ResumeManifest } from "@rivetjs/runtime/server-resume";
import { _compileSymbolModule, check, compile, type ResumeSymbol } from "../index.ts";
import { importServer } from "../../runtime/tests/resume/compile.ts";

const resume = { module: "src/rows.tsx" };
const head = `import { For } from "@rivetjs/runtime/dom";\nimport { signal } from "@rivetjs/reactivity";\n`;
type Fact = { lazy: boolean; reason?: string; symbol?: string; key?: string; by?: boolean; index?: boolean; line: number; column: number };
const out = (source: string, target: "server" | "dom" = "server") => {
  const result = compile(head + source, { target, filename: "src/rows.tsx", resume });
  assert.deepEqual(result.diagnostics, [], JSON.stringify(result.diagnostics));
  return result as typeof result & { forRows?: Fact[] };
};
const facts = (source: string) => (out(source).forRows ?? []).map((f) => (f.lazy ? "lazy" : f.reason));

test("eligible: an inline row function → row symbol (`_rFn`) + `$lazy`; key paths, index flag, function `by`", () => {
  const rows = `import { Row } from "./row";
export function List(props: { items: { id: string; a: { b: number } }[]; prefix: string }) {
  const sel = signal("");
  return <ul>
    <For each={props.items} by={(r) => r.id}>{(row) => <Row item={row()} selected={sel() === row().id} onPress={() => sel.set(row().id)} />}</For>
    <For each={props.items} by={(r) => r["a"].b}>{(row, i) => <li>{i()}:{row().id}</li>}</For>
    <For each={props.items} by={(r) => props.prefix + r.id}>{(row) => <li>{row().id}</li>}</For>
  </ul>;
}`;
  const server = out(rows);
  const [a, b, c] = server.forRows!;
  assert.equal(server.forRows!.length, 3);
  assert.deepEqual([a!.lazy, a!.key, a!.by, a!.index], [true, "id", undefined, undefined]);
  assert.deepEqual([b!.lazy, b!.key, b!.index], [true, "a.b", true]);
  assert.deepEqual([c!.lazy, c!.key, c!.by], [true, undefined, true]);
  assert.deepEqual([a!.line, a!.column], [7, 5]);
  const code = server.code.replaceAll(/\s+/g, " ");
  const id = (s: string) => s.replaceAll("$", "\\$");
  // Row symbol: `_rFn(rowId, row, captures)`; the key-path `by` stays the hoisted function (server keying unchanged).
  assert.match(code, new RegExp(`"by": __rivetBy\\d+, "\\$lazy": \\[0, "id"\\], children: __rivetR_fn\\("${id(a!.symbol!)}", \\(row\\) => Row\\(`));
  assert.match(code, /"\$lazy": \[1, "a\.b"\]/);
  // A function `by` reading props: its own Fn site (recipe), flag 2, no key.
  assert.match(code, /"by": __rivetR_fn\("src\/rows\.tsx#List\$\w+", \(r\) => props\.prefix \+ r\.id, \[props\]\), children: .*?"\$lazy": \[2\]/);
  // The row symbol is a slot symbol over the row function's own captures; the browser module compiles it (adopt-mode
  // lowering is T5).
  const dom = out(rows, "dom");
  const symbol = dom.symbols!.find((s) => s.id === a!.symbol)!;
  assert.deepEqual([symbol.kind, symbol.captures, symbol.locals], ["slot", ["sel"], ["Row"]]);
  assert.match(symbol.source, /= \(sel\) => \(\(row\) => <Row item=\{row\(\)\}/);
  const module = _compileSymbolModule(dom.symbols! as ResumeSymbol[], "/src/rows.tsx");
  assert.match(module, new RegExp(`export const ${id(symbol.name)} = \\(sel\\) => \\(\\(row\\) => __rivet_c\\(Row, `));
  // DOM module code carries no row wrapper (the For lowers as before; only the symbol list grew).
  assert.doesNotMatch(dom.code, /\$lazy|__rivetR_/);
});

test("recorded: one reason per For, no `$lazy`, no row symbol", () => {
  const cases: [string, string][] = [
    ["row", `const renderRow = (r: () => number) => <li>{r()}</li>;\n  return <ul><For each={xs} by={(x) => x}>{renderRow}</For></ul>;`],
    ["spread", `const o = { by: (x: number) => x };\n  return <ul><For {...o} each={xs}>{(x) => <li>{x()}</li>}</For></ul>;`],
    ["by", `const keyOf = (x: number) => x;\n  return <ul><For each={xs} by={keyOf}>{(x) => <li>{x()}</li>}</For></ul>;`],
    ["nondeterministic", `return <ul><For each={xs} by={(x) => x}>{(x) => <li data-t={Date.now()}>{x()}</li>}</For></ul>;`],
    ["nondeterministic", `return <ul><For each={xs} by={(x) => x}>{(x) => <li>{String(new Date())}{x()}</li>}</For></ul>;`],
    ["capture", `return <ul><For each={xs} by={(x) => x}>{(x) => <li>{p.children}{x()}</li>}</For></ul>;`],
    ["ref", `const el = ref<HTMLElement>();\n  return <ul><For each={xs} by={(x) => x}>{(x) => <li ref={el}>{x()}</li>}</For></ul>;`],
    ["portal", `return <ul><For each={xs} by={(x) => x}>{(x) => <li><Portal><b>{x()}</b></Portal></li>}</For></ul>;`],
  ];
  for (const [reason, body] of cases) {
    const source = `import { ref } from "@rivetjs/runtime/dom";\nimport { Portal } from "./portal";
export function L(p: { children?: unknown }) {\n  const xs = signal([1, 2]);\n  ${body}\n}`;
    assert.deepEqual(facts(source), [reason], body);
    const server = out(source);
    assert.doesNotMatch(server.code, /\$lazy/, body);
    assert.ok(!server.forRows![0]!.symbol, body);
  }
});

test("eligible despite browser-only reads: handlers, effects and timers in a row are not its render", () => {
  const source = `import { effect } from "@rivetjs/reactivity";
export function L() {
  const xs = signal([1, 2]), last = signal(0);
  return <ul><For each={xs} by={(x) => x}>{(x) => {
    effect(() => last.set(Date.now()));
    return <li onClick={() => last.set(Math.random())} on:pointerenter={() => last.set(performance.now())}>{x()}</li>;
  }}</For></ul>;
}`;
  assert.deepEqual(facts(source), ["lazy"]);
  assert.equal(out(source).warnings, undefined);
});

test("nested Fors decide independently; the inner row symbol nests in the outer one", () => {
  const source = `export function G(p: { groups: { id: string; items: number[] }[] }) {
  return <div><For each={p.groups} by={(g) => g.id}>{(g) => <section><For each={g().items} by={(x) => x}>{(x) => <i>{x()}</i>}</For></section>}</For></div>;
}`;
  const server = out(source);
  assert.deepEqual(facts(source), ["lazy", "lazy"]);
  const [outer, inner] = server.forRows!;
  assert.match(
    server.code.replaceAll(/\s+/g, " "),
    new RegExp(`__rivetR_fn\\("${outer!.symbol!.replaceAll("$", "\\$")}", \\(g\\) => .*__rivetR_fn\\("${inner!.symbol!.replaceAll("$", "\\$")}", \\(x\\) => `),
  );
});

test("RV2105 / RV2106: warnings on the server target (code still emitted), `check` reports them with severity warning", () => {
  const sources: [string, string, RegExp][] = [
    [
      "RV2105",
      `(x) => <li data-t={Math.random()}>{x()}</li>`,
      /^Keyed `For` row renders non-deterministically: `Math\.random\(\)` runs while rendering the row/,
    ],
    ["RV2105", `(x) => <li>{crypto.randomUUID()}{x()}</li>`, /`crypto\.randomUUID\(\)`/],
    ["RV2106", `(x) => <li><Chart n={x()} /></li>`, /^Keyed `For` row holds `<Chart>` \(a `clientOnly` component\), which a lazy row cannot replay/],
    ["RV2106", `(x) => <li><Async load={() => x()}>{(v) => <b>{String(v())}</b>}</Async></li>`, /^Keyed `For` row holds `<Async>`/],
    ["RV2106", `(x) => <li ref={(e) => (last = e)}>{x()}</li>`, /^Keyed `For` row holds a `ref` into `last`, declared outside the row/],
  ];
  for (const [code, row, message] of sources) {
    const source = `import { clientOnly, Async } from "@rivetjs/runtime/dom";
const Chart = clientOnly(() => import("./chart"), (m: { Chart: (p: { n: number }) => unknown }) => m.Chart);
export function L() {\n  const xs = signal([1, 2]);\n  let last: HTMLElement | undefined;\n  return <ul onClick={() => last?.focus()}><For each={xs} by={(x) => x}>{${row}}</For></ul>;\n}`;
    const server = compile(head + source, { target: "server", filename: "src/rows.tsx", resume });
    assert.deepEqual(server.diagnostics, [], row);
    assert.notEqual(server.code, "", row);
    assert.deepEqual(
      server.warnings!.map((w) => [w.code, w.severity]),
      [[code, "warning"]],
      row,
    );
    assert.match(server.warnings![0]!.message, message, row);
    // DOM target: no warning (one report per module, from the server compile).
    assert.equal(compile(head + source, { target: "dom", filename: "src/rows.tsx", resume }).warnings, undefined, row);
    const checked = check(head + source, { filename: "src/rows.tsx", resume });
    const found = checked.diagnostics.filter((d) => d.code === code);
    assert.deepEqual(
      found.map((d) => [d.severity, d.targets]),
      [["warning", ["server"]]],
      row,
    );
  }
  // Not a row: the same read in the component body is not reported (RV2105 is about row bodies only).
  const body = compile(
    head +
      `export function L() { const xs = signal([1]); const t = Date.now(); return <ul><For each={xs} by={(x) => x}>{(x) => <li data-t={t}>{x()}</li>}</For></ul>; }`,
    {
      target: "server",
      filename: "src/rows.tsx",
      resume,
    },
  );
  assert.equal(body.warnings, undefined);
});

test("`check` reports forRows with UTF-16 ranges; non-resume compiles report none", () => {
  const source = head + `// é\nexport function L() { const xs = signal([1]); return <ul><For each={xs} by={(x) => x}>{(x) => <li>{x()}</li>}</For></ul>; }`;
  const checked = check(source, { filename: "src/rows.tsx", resume }) as ReturnType<typeof check> & { forRows?: (Fact & { start: number; end: number })[] };
  const [fact] = checked.forRows!;
  assert.equal(source.slice(fact!.start, fact!.end).startsWith("<For each={xs}"), true);
  assert.equal(source.slice(fact!.start, fact!.end).endsWith("</For>"), true);
  assert.equal(fact!.lazy, true);
  assert.ok(checked.sites.some((s) => s.kind === "slot" && s.id === fact!.symbol));
  const plain = compile(source, { target: "server", filename: "src/rows.tsx" }) as { forRows?: unknown };
  assert.equal(plain.forRows, undefined);
});

test("recorded Fors keep HEAD's bytes: oracle corpus cases recorded before LAZY-T2", () => {
  // Cases 227–236 (oracle/CLAUDE.md "LAZY-T2"): `code` / `symbols` recorded with the wasm before this change, `forRows` added.
  const lines = readFileSync(new URL("../oracle/corpus.jsonl", import.meta.url), "utf8")
    .trim()
    .split("\n");
  const untag = (_k: string, v: unknown) => (v && typeof v === "object" && "$undefined" in v ? undefined : v);
  let recorded = 0;
  for (const line of lines.slice(227)) {
    const c = JSON.parse(line, untag) as { args: [string, object]; result: { code: string; symbols?: unknown; forRows?: Fact[] } };
    if (!c.result.forRows?.every((f) => !f.lazy)) continue;
    const result = compile(...c.args);
    assert.equal(result.code, c.result.code);
    assert.deepEqual(result.symbols, c.result.symbols);
    recorded++;
  }
  assert.ok(recorded >= 8, `${recorded} recorded-For cases`);
});

test("a lazy For renders the same HTML and state as the recorded lowering (row symbol only registered)", async () => {
  const source = (lazy: boolean) => `import { For } from "@rivetjs/runtime/server";
import { signal } from "@rivetjs/reactivity";
export function Page(p: { rows: { id: number; label: string }[] }) {
  const sel = signal(2);
  return <ul><For ${lazy ? "" : "{...{}} "}each={() => p.rows} by={(r) => r.id}>{(row) =>
    <li class={sel() === row().id ? "on" : "off"}><button onClick={() => sel.set(row().id)}>{row().label}</button></li>}</For></ul>;
}`;
  const rows = [
    { id: 1, label: "a" },
    { id: 2, label: "b<" },
  ];
  const render = async (lazy: boolean) => {
    const server = compile(source(lazy), { target: "server", filename: "src/page.tsx", resume });
    const dom = compile(source(lazy), { target: "dom", filename: "src/page.tsx", resume });
    assert.deepEqual(server.diagnostics, []);
    assert.equal(server.code.includes('"$lazy"'), lazy);
    const manifest: ResumeManifest = { runtime: "/rt.js", symbols: Object.fromEntries(dom.symbols!.map((s) => [s.id, "/c.js"])) };
    const mod = await importServer<{ Page(p: { rows: typeof rows }): never }>(server.code + `\n// ${lazy}`);
    const html = (await resumableToString(() => mod.Page({ rows }), { manifest })) as string;
    // Symbol ids differ between the variants (content hashes over different region text): compare without them.
    return html.replaceAll(/src\/rows\.tsx#\w+\$\w+/g, "#").replaceAll(/Page\$\w+/g, "Page$");
  };
  assert.equal(await render(true), await render(false));
});

test("a non-JSX row function keeps its nested sites: a `computed` created in the row registers on the server (Masonry rows)", async () => {
  // Fix 2026-10-19: the row Fn site was added during the scan, so the row body counted as a site closure and its
  // `computed(…)` stayed a plain call — "computed was not created in a resume-compiled component" at encode.
  const source = `import { For } from "@rivetjs/runtime/server";
import { signal, computed, untrack } from "@rivetjs/reactivity";
export function Page(p: { rows: { id: number; label: string }[] }) {
  const rows = signal(p.rows);
  const keys = computed(() => rows().map((r) => r.id));
  const itemOf = (key: number, label: () => string) => <li data-key={key}>{label()}</li>;
  return <ul><For each={keys} by={(k) => k}>{(keyOf) => {
    const key = untrack(keyOf);
    const label = computed(() => rows().find((r) => r.id === key)?.label ?? "");
    return itemOf(key, label);
  }}</For></ul>;
}`;
  const server = compile(source, { target: "server", filename: "src/page.tsx", resume });
  const dom = compile(source, { target: "dom", filename: "src/page.tsx", resume });
  assert.deepEqual(server.diagnostics, []);
  assert.ok(server.code.includes('"$lazy"'), "the For is lazy");
  const row = server.code.slice(server.code.indexOf("children: __rivetR_fn("));
  assert.match(row, /const label = __rivetR_computed\("src\/rows\.tsx#Page\$\w+", \(\) => rows\(\)/, "the row's computed is a site");
  const manifest: ResumeManifest = { runtime: "/rt.js", symbols: Object.fromEntries(dom.symbols!.map((s) => [s.id, "/c.js"])) };
  const mod = await importServer<{ Page(p: { rows: { id: number; label: string }[] }): never }>(server.code);
  const html = (await resumableToString(
    () =>
      mod.Page({
        rows: [
          { id: 1, label: "a" },
          { id: 2, label: "b" },
        ],
      }),
    { manifest },
  )) as string;
  // Text markers (`<!--r1-->a<!--/-->`) sit around the bound text.
  assert.match(html, /<li data-key="1">(?:<!--[^>]*-->)*a<!--\/--><\/li>/);
  assert.match(html, /<li data-key="2">(?:<!--[^>]*-->)*b<!--\/--><\/li>/);
});
