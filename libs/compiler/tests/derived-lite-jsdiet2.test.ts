// JS-DIET-2 (2026-10-28, `rust/src/compile/derived_lite.rs`): lite residuals for real-page constructs — live bindings /
// computeds / handlers over the record's props (`const props = __rivetLr.p`), `<select value>` over static options and
// `<input value>` (`_lv`), conditional native subtrees (`_lo`, nested), `<For each={() => …}>`. Output shape here; the
// residual runs end to end against the real derived server target in Chromium at the bottom.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile, hasDerivedModel } from "../index.ts";
import type { ServerValue } from "../../runtime/server.ts";
import { derivedToString } from "../../runtime/server-derived.ts";
import { importServer } from "../../runtime/tests/resume/compile.ts";
import { DERIVED_BUILD, rewrite, withPage } from "../../runtime/tests/resume/harness.ts";

const it = hasDerivedModel() ? test : test.skip;
const RESUME = { module: "src/a.tsx", boundaries: ["App"], independent: ["App"] };
const dom = (source: string) => compile(source, { target: "dom", filename: "a.tsx", resume: RESUME } as never);
const flat = (source: string) => dom(source).lite?.code.replace(/\s+/g, " ");
const because = (source: string) => (dom(source) as { liteBecause?: Record<string, string> }).liteBecause?.App;
const HEAD = `import { signal, computed } from "@rivetjs/reactivity"; import { For } from "@rivetjs/runtime/dom";\n`;

it("props in live code: computeds, bindings, handlers and list sources read the record's props", () => {
  const code = flat(
    HEAD +
      `export function App(props) { const n = signal(0); const rows = computed(() => props.data.slice(0, n()));
  return <div><p>{rows().length}</p><button disabled={n() >= props.data.length} onClick={() => n.set(n() + props.step)}>more</button><ul><For each={() => rows()} by={(r) => r.id}>{(r) => <li>{r().name}</li>}</For></ul></div>; }`,
  );
  assert.ok(code, String(code));
  assert.match(code!, /export function App\$a\(__rivetLn, __rivetLr\) \{ const props = __rivetLr\.p; const n = __rivetL_s\(/);
  assert.match(code!, /const rows = __rivetL_c\(\(\) => props\.data\.slice\(0, n\(\)\)\);/);
  assert.match(code!, /__rivetL_b\(__rivetLe\d+, "disabled", \(\) => n\(\) >= props\.data\.length\);/);
  assert.match(code!, /"click", \(\) => n\.set\(n\(\) \+ props\.step\)\);/);
  assert.match(code!, /__rivetL_f\(__rivetL_w\(__rivetLn, "[fnh]+"\), \(\) => rows\(\), \(r\) => r\.id, /);
  // A boundary that reads no props live declares none.
  assert.ok(
    !flat(HEAD + `export function App(props) { const n = signal(0); return <button onClick={() => n.set(1)}>{props.label}{n()}</button>; }`)!.includes(
      "__rivetLr.p",
    ),
  );
  // A destructured parameter has no name to declare.
  assert.equal(
    because(HEAD + `export function App({ step }) { const n = signal(0); return <button onClick={() => n.set(step)}>{n()}</button>; }`),
    "props pattern",
  );
});

it("<select value> over static options and <input value>: `_lv`; options never walked; dynamic options / multiple stay ineligible", () => {
  const code = flat(
    HEAD +
      `export function App() { const s = signal("a"); const q = signal("");
  return <div><input value={q()} onInput={(e) => q.set(e.currentTarget.value)} /><select value={s()} onChange={(e) => s.set(e.currentTarget.value)}><option value="a">A</option>
  <option value="b">B</option></select><p>{s()}{q()}</p></div>; }`,
  );
  assert.ok(code, String(code));
  assert.match(code!, /__rivetL_v\(__rivetLe\d+, \(\) => q\(\)\);/);
  assert.match(code!, /__rivetL_v\(__rivetLe\d+, \(\) => s\(\)\);/);
  assert.ok(!code!.includes("__rivetL_a(") && !code!.includes("option"), code);
  assert.equal(
    because(
      HEAD +
        `export function App() { const s = signal("a"); return <select value={s()} onChange={(e) => s.set(e.currentTarget.value)}><option value={s()}>A</option></select>; }`,
    ),
    "element kind",
  );
  assert.equal(
    because(
      HEAD +
        `export function App() { const s = signal("a"); return <select multiple value={s()} onChange={(e) => s.set(e.currentTarget.value)}><option value="a">A</option></select>; }`,
    ),
    "element kind",
  );
});

it("conditional native subtree: `_lo(opener, test, branch, spec)`, nested; sole / static / component branches stay ineligible", () => {
  const code = flat(
    HEAD +
      `export function App() { const open = signal(false); const q = signal("");
  return <div><button onClick={() => open.set(!open())}>t</button>{open() ? <section class="d"><input value={q()} onInput={(e) => q.set(e.currentTarget.value)} /><nav>{"ab".includes(q()) ? <a href="#a" onClick={() => open.set(false)}>A</a> : null}{"b".includes(q()) ? <a href="#b">B</a> : undefined}</nav></section> : null}</div>; }`,
  );
  assert.ok(code, String(code));
  assert.match(
    code!,
    /__rivetL_o\(__rivetL_w\(__rivetLn, "fn"\), \(\) => open\(\), \(__rivetLn(\d+)\) => \{ const __rivetLe\d+ = __rivetL_w\(__rivetLn\1, "f"\);/,
  );
  assert.match(
    code!,
    /__rivetL_o\(__rivetL_w\(__rivetLn\d+, "fnf"\), \(\) => "ab"\.includes\(q\(\)\), \(__rivetLn(\d+)\) => \{ __rivetL_e\(__rivetLr, __rivetLn\1, "click", \(\) => open\.set\(false\)\); \}, \[ ?"a", \{ "href": "#a" \}, "A" ?\]\);/,
  );
  assert.match(
    code!,
    /__rivetL_o\(__rivetL_w\(__rivetLn\d+, "fnfhn"\), \(\) => "b"\.includes\(q\(\)\), \(__rivetLn\d+\) => \{ ?\}, \[ ?"a", \{ "href": "#b" \}, "B" ?\]\);/,
  );
  assert.match(code!, /\[ ?"section", \{ "class": "d" \}, \[ ?"input", \{\}\], \[ ?"nav", \{\}, 0, 1, 0, 1 ?\] ?\]\);/);
  assert.equal(
    because(HEAD + `export function App() { const n = signal(0); return <button onClick={() => n.set(1)}>{n() ? <b>x</b> : null}</button>; }`),
    "sole conditional",
  );
  assert.equal(
    because(
      HEAD +
        `export function App(props) { const n = signal(0); return <div><button onClick={() => n.set(1)}>{n()}</button>{props.on ? <b>x</b> : null}</div>; }`,
    ),
    "static conditional",
  );
  assert.equal(
    because(
      HEAD +
        `import { Icon } from "./icon.tsx";\nexport function App() { const n = signal(0); return <div><button onClick={() => n.set(1)}>{n()}</button>{n() ? <b><Icon /></b> : null}</div>; }`,
    ),
    "conditional component child",
  );
});

const PAGE = `import { signal, computed } from "@rivetjs/reactivity";
export function App(props: { items: string[] }) {
  const open = signal(false);
  const query = signal("");
  const sort = signal("a");
  const shown = computed(() => props.items.filter((x) => x.includes(query())).length);
  return <div class="app"><button class="toggle" onClick={() => open.set(!open())}>Toggle</button><select class="sort" value={sort()} onChange={(e) => sort.set(e.currentTarget.value)}><option value="a">A</option><option value="b">B</option></select><p class="count">{shown()}</p>{open() ? <section class="dialog"><input class="q" value={query()} onInput={(e) => query.set(e.currentTarget.value)} /><nav>{"alpha".includes(query()) ? <a class="hit" href="#a" onClick={() => open.set(false)}>Alpha</a> : null}{"beta".includes(query()) ? <a class="hit" href="#b" onClick={() => open.set(false)}>Beta</a> : null}</nav><button class="close" onClick={() => open.set(false)}>Close</button></section> : null}<p class="sorted">{sort()}</p></div>;
}`;

it("end to end: the compiled residual adopts, opens / filters / closes the dialog and writes the selection, lite only", async () => {
  const server = compile(PAGE, { target: "server", filename: "a.tsx", resume: RESUME } as never);
  const out = dom(PAGE);
  assert.deepEqual(server.diagnostics, []);
  assert.ok(out.lite, JSON.stringify((out as { liteBecause?: unknown }).liteBecause));
  const { App } = await importServer<{ App: (props: { items: string[] }) => ServerValue }>(server.code);
  const html = (await derivedToString(() => App({ items: ["ab", "abc", "b"] }), {
    manifest: { runtime: "/lite.js", symbols: { "src/a.tsx#App": "/a.js" } },
  })) as string;
  const files = {
    ...DERIVED_BUILD,
    "/": "<!doctype html><html><body>" + html + "</body></html>",
    "/lite.js": 'export { default } from "/dom-lite.ts";',
    "/a.js": rewrite(out.lite!.code.replace(/import\("[^"]*a\.tsx"\)/, 'import("/a-full.js")')),
    "/a-full.js": rewrite(out.code),
  };
  await withPage(files, async (page, requests) => {
    await page.goto("http://rivet.test/");
    await page.click(".toggle");
    await page.waitForFunction(() => document.querySelectorAll(".dialog").length === 1);
    await page.fill(".q", "be");
    await page.waitForFunction(() => document.querySelectorAll(".hit").length === 1 && document.querySelector(".count")!.textContent === "0");
    await page.click(".hit");
    await page.waitForFunction(() => document.querySelectorAll(".dialog").length === 0);
    await page.selectOption(".sort", "b");
    await page.waitForFunction(() => document.querySelector(".sorted")!.textContent === "b");
    assert.ok(!requests.includes("/dom-derived.ts") && !requests.includes("/a-full.js"), requests.join(" "));
  });
});
