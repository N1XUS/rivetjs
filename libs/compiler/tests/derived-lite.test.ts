// ZERO C1 (2026-10-25, ownership §3.1): the derived DOM target returns a lite entry (`compile()` result `lite`) with a
// residual `<Name>$a(node, rec)` per eligible independent boundary (`rust/src/compile/derived_lite.rs`): keyed state
// through `_ls`, handlers `_le`, live text `_lt`, live attributes `_la`, node paths `_lw` over the server markup, plus
// `<Name>$c` (the ordinary module, dynamic import). End to end against the real derived server target and
// `@rivetjs/runtime/dom-lite` (lite runtime) / `dom-derived` (full runtime, R5) in Chromium.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile, hasDerivedModel } from "../index.ts";
import type { ServerValue } from "../../runtime/server.ts";
import { derivedToString } from "../../runtime/server-derived.ts";
import { importServer } from "../../runtime/tests/resume/compile.ts";
import { DERIVED_BUILD, rewrite, withPage } from "../../runtime/tests/resume/harness.ts";
import type { Page } from "playwright";

const it = hasDerivedModel() ? test : test.skip;
const RESUME = { module: "src/c.tsx", boundaries: ["Card"], independent: ["Card"] };
const dom = (source: string, resume: object = RESUME) => compile(source, { target: "dom", filename: "c.tsx", resume } as never);
const lite = (source: string, resume: object = RESUME) => dom(source, resume).lite;

const CARD = `import { signal } from "@rivetjs/reactivity";
const LABELS = ["off", "on"];
export function Card({ title, n }: { title: string; n: number }) {
  const on = signal(false);
  const count = signal(0);
  const unit = signal("x");
  return (
    <div class="c" data-n={n}>
      <h3>{title}</h3>
      <p class="t">Clicks: {count()} {unit()} of {n}<b>{count() > 1 ? "many" : "few"}</b> end</p>
      <button type="button" class="inc" aria-pressed={on() ? "true" : "false"} onClick={() => { count.update((c) => c + 1); on.set(!on()); }}>
        {LABELS[on() ? 1 : 0]}
      </button>
      <span class="e">{on() ? "" : "empty when on"}</span>
    </div>
  );
}
export function Page(props: { n: number }) {
  return <main>{Array.from({ length: props.n }, (_, i) => <Card title={"Card " + i} n={i} />)}</main>;
}`;

it("C1: lite entry for an eligible independent boundary; static props text needs no binding", () => {
  const out = dom(CARD);
  assert.deepEqual(out.diagnostics, []);
  // The ordinary module is unchanged; the entry never imports it statically.
  assert.ok(!out.code.includes("Card$a") && !out.code.includes("dom-lite"), out.code);
  assert.deepEqual(out.lite?.names, ["src/c.tsx#Card"]);
  const code = out.lite!.code.replace(/\s+/g, " ");
  assert.match(code, /^import \{ _ls as \w+, _le as \w+, _lt as \w+, _lw as \w+, _la as \w+ \} from "@rivetjs\/runtime\/dom-lite";/);
  assert.ok(!/import \{[^}]*\} from "\.?\/?c\.tsx"/.test(code) && !code.includes("@rivetjs/runtime/dom-derived"), code);
  // A module constant live code reads is copied (data literal).
  assert.match(code, /const LABELS = \["off", "on"\];/);
  assert.match(code, /export function Card\$a\(/);
  assert.match(code, /export const Card\$c = \(\) => import\("c\.tsx"\)/);
  // keyed state by key, init re-evaluated (data literal); `unit` is never written: re-declared only if live code reads it.
  assert.match(code, /const on = __rivetL_s\(__rivetLr, "[0-9a-z]{5}-0", false\)/);
  assert.match(code, /const count = __rivetL_s\(__rivetLr, "[0-9a-z]{5}-1", 0\)/);
  assert.ok(!/__rivetL_s\([^)]*"x"\)/.test(code) && !code.includes("@rivetjs/reactivity"), code);
  // `{title}` / `{n}` / `data-n` are props (recorded data, never change): no binding.
  assert.ok(!code.includes("title") && !code.includes("data-n"), code);
  assert.match(code, /__rivetL_a\(__rivetLe\d, "aria-pressed", \(\) => on\(\) \? "true" : "false"\)/);
  assert.match(code, /__rivetL_e\(__rivetLr, __rivetLe\d, "click", \(\) => \{/);
});

it("C3: props-derived locals (`const { a } = props`, `const a = props.a`) are static like props", () => {
  const code = lite(`import { signal } from "@rivetjs/reactivity";
export function Card(props) { const { title, n: count } = props; const author = props.author; const read = signal(false);
  return <li><p>{title}</p><p>{author} {count}</p><button onClick={() => read.update((v) => !v)}>{read() ? "Read" : "Not read"}</button></li>; }`)?.code;
  assert.ok(code && code.includes("Card$a") && !code.includes("title") && !code.includes("author"), String(code));
  // Read by live code or a handler: not lite.
  assert.equal(
    lite(`import { signal } from "@rivetjs/reactivity";
export function Card(props) { const { title } = props; const read = signal(false); return <button onClick={() => read.set(!read())}>{read() ? title : "-"}</button>; }`),
    undefined,
  );
});

it("C1: a never-written signal a handler reads is re-declared (its `signal` import comes along)", () => {
  const code = lite(`import { signal as s } from "@rivetjs/reactivity";
export function Card() { const step = s(2); const n = s(0); return <button onClick={() => n.set(n() + step())}>{n()}</button>; }`)!.code;
  assert.match(code, /import \{ signal as s \} from "@rivetjs\/reactivity";/);
  assert.match(code, /const step = s\(2\);/);
});

it("C1: ineligible boundaries keep the ordinary adopt (no residual)", () => {
  const cases: Record<string, string> = {
    dependent: CARD,
    component: `import { signal } from "@rivetjs/reactivity";\nimport { Icon } from "./icon.tsx";\nexport function Card() { const n = signal(0); return <button onClick={() => n.set(1)}><Icon />{n()}</button>; }`,
    spread: `import { signal } from "@rivetjs/reactivity";\nexport function Card(props) { const n = signal(0); return <button {...props} onClick={() => n.set(1)}>{n()}</button>; }`,
    propsInHandler: `import { signal } from "@rivetjs/reactivity";\nexport function Card(props) { const n = signal(0); return <button onClick={() => n.set(props.step)}>{n()}</button>; }`,
    local: `import { signal, computed } from "@rivetjs/reactivity";\nexport function Card() { const n = signal(0); const d = computed(() => n() * 2); return <button onClick={() => n.set(1)}>{d()}</button>; }`,
    structural: `import { signal } from "@rivetjs/reactivity";\nexport function Card() { const n = signal(0); return <button onClick={() => n.set(1)}>{n() ? <b>x</b> : null}</button>; }`,
    nonDelegated: `import { signal } from "@rivetjs/reactivity";\nexport function Card() { const n = signal(0); return <div onScroll={() => n.set(1)}>{n()}</div>; }`,
    moduleSignal: `import { signal } from "@rivetjs/reactivity";\nconst shared = signal(0);\nexport function Card() { const n = signal(0); return <button onClick={() => { n.set(1); shared.set(1); }}>{n()}</button>; }`,
    imported: `import { signal } from "@rivetjs/reactivity";\nimport { step } from "./step.ts";\nexport function Card() { const n = signal(0); return <button onClick={() => n.set(step)}>{n()}</button>; }`,
    liveClass: `import { signal } from "@rivetjs/reactivity";\nexport function Card() { const n = signal(0); return <button class={n() ? "a" : "b"} onClick={() => n.set(1)}>x</button>; }`,
  };
  for (const [name, source] of Object.entries(cases)) {
    const resume = name === "dependent" ? { ...RESUME, independent: [] } : RESUME;
    const out = dom(source, resume);
    assert.equal(out.lite, undefined, `${name}: ${out.lite?.code}`);
    const why =
      (out as { liteBecause?: Record<string, string> }).liteBecause?.["src/c.tsx#Card"] ?? (out as { liteBecause?: Record<string, string> }).liteBecause?.Card;
    assert.ok(why && (name !== "dependent" || why === "dependent"), `${name}: ${JSON.stringify((out as { liteBecause?: unknown }).liteBecause)}`);
  }
});

async function files(n: number, runtime: "lite" | "full"): Promise<Record<string, string>> {
  const server = compile(CARD, { target: "server", filename: "c.tsx", resume: RESUME } as never);
  const client = dom(CARD);
  assert.deepEqual(server.diagnostics, []);
  const { Page } = await importServer<{ Page: (props: { n: number }) => ServerValue }>(server.code);
  const rt = runtime === "lite" ? "/lite.js" : "/rt.js";
  const html = (await derivedToString(() => Page({ n }), { manifest: { runtime: rt, symbols: { "src/c.tsx#Card": "/c.js" } } })) as string;
  return {
    ...DERIVED_BUILD,
    "/": "<!doctype html><html><body>" + html + "</body></html>",
    "/lite.js": 'export { default } from "/dom-lite.ts";',
    "/rt.js": 'export { default } from "/dom-derived.ts";',
    "/c.js": rewrite(client.lite!.code.replace('import("c.tsx")', 'import("/c-full.js")')),
    "/c-full.js": rewrite(client.code),
  };
}
const state = (page: Page, i: number) =>
  page.evaluate((i) => {
    const c = document.querySelectorAll(".c")[i]!;
    return [
      c.querySelector(".t")!.textContent,
      c.querySelector(".inc")!.textContent!.trim(),
      c.querySelector(".inc")!.getAttribute("aria-pressed"),
      c.querySelector(".e")!.textContent,
    ];
  }, i);

for (const runtime of ["lite", "full"] as const) {
  it(`C1 end to end (${runtime} runtime): the compiled residual adopts the clicked card over the server nodes`, async () => {
    await withPage(await files(3, runtime), async (page, requests) => {
      await page.goto("http://rivet.test/");
      assert.deepEqual(await state(page, 1), ["Clicks: 0 x of 1few end", "off", "false", "empty when on"]);
      await page.evaluate(() => document.querySelectorAll(".c *").forEach((el, i) => ((el as unknown as { __t: number }).__t = i)));
      await page.click(".c:nth-child(2) .inc");
      await page.waitForFunction(() => document.querySelectorAll(".inc")[1]!.textContent!.trim() === "on");
      assert.deepEqual(await state(page, 1), ["Clicks: 1 x of 1few end", "on", "true", ""]);
      await page.click(".c:nth-child(2) .inc");
      await page.waitForFunction(() => document.querySelectorAll(".inc")[1]!.textContent!.trim() === "off");
      assert.deepEqual(await state(page, 1), ["Clicks: 2 x of 1many end", "off", "false", "empty when on"]);
      assert.deepEqual(await state(page, 0), ["Clicks: 0 x of 0few end", "off", "false", "empty when on"]);
      assert.ok(
        await page.evaluate(() => [...document.querySelectorAll(".c *")].every((el, i) => (el as unknown as { __t: number }).__t === i)),
        "server elements kept",
      );
      if (runtime === "lite") assert.ok(!requests.includes("/dom-derived.ts"), requests.join(" "));
      assert.ok(!requests.includes("/c-full.js"), requests.join(" "));
      assert.equal(await page.evaluate(() => (globalThis as { __componentRuns?: number }).__componentRuns), undefined);
    });
  });
}
