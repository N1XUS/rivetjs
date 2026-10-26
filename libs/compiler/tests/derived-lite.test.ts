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
  assert.match(code, /^import \{ _ls as \w+, _le as \w+, _lt as \w+, _lw as \w+, _lq as \w+ \} from "@rivetjs\/runtime\/dom-lite";/);
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
  // A plain attribute: `_lq` (`setAttribute`; RT-DIET: the writer is picked by name, `_la` only for URL / form / enumerated ones).
  assert.match(code, /__rivetL_q\(__rivetLe\d, "aria-pressed", \(\) => on\(\) \? "true" : "false"\)/);
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

it("C1: a never-written signal a handler reads is re-declared (the lite world's `signal`, RT-DIET)", () => {
  const code = lite(`import { signal as s } from "@rivetjs/reactivity";
export function Card() { const step = s(2); const n = s(0); return <button onClick={() => n.set(n() + step())}>{n()}</button>; }`)!.code;
  assert.match(code, /import \{ signal as s \} from "@rivetjs\/runtime\/dom-lite";/);
  assert.ok(!code.includes("@rivetjs/reactivity"), code);
  assert.match(code, /const step = s\(2\);/);
});

it("RT-DIET: a keyed signal no live code reads is not declared; a non-literal init comes from the record (no init argument)", () => {
  const code = lite(`import { signal } from "@rivetjs/reactivity";
export function Card() {
  const at = signal(new Date().toISOString());
  const start = signal(Date.now());
  const n = signal(0);
  return <div><p>{at()}</p><button onClick={() => (n.set(n() + 1), start.set(Date.now()))}>{n()} {start()}</button></div>;
}`)!.code.replace(/\s+/g, " ");
  // `at` is never written: its text is what the server rendered (static), no declaration, its init never runs again.
  assert.ok(!code.includes("toISOString") && !/const at\b/.test(code), code);
  // `start` is live (a binding reads it): the record's value, no init argument (a miss when the record lacks it).
  assert.match(code, /const start = __rivetL_s\(__rivetLr, "[0-9a-z]{5}-1"\);/);
  assert.ok(!code.includes("signal(Date.now"), code);
  assert.match(code, /const n = __rivetL_s\(__rivetLr, "[0-9a-z]{5}-2", 0\);/);
});

it("C1: ineligible boundaries keep the ordinary adopt (no residual)", () => {
  const cases: Record<string, string> = {
    dependent: CARD,
    // RT-DIET2: a component child with a live prop (a static one is skipped, `derived-lite-static.test.ts`).
    component: `import { signal } from "@rivetjs/reactivity";\nimport { Icon } from "./icon.tsx";\nexport function Card() { const n = signal(0); return <button onClick={() => n.set(1)}><Icon n={n()} />{n()}</button>; }`,
    spread: `import { signal } from "@rivetjs/reactivity";\nexport function Card(props) { const n = signal(0); return <button {...props} onClick={() => n.set(1)}>{n()}</button>; }`,
    propsInHandler: `import { signal } from "@rivetjs/reactivity";\nexport function Card(props) { const n = signal(0); return <button onClick={() => n.set(props.step)}>{n()}</button>; }`,
    structural: `import { signal } from "@rivetjs/reactivity";\nexport function Card() { const n = signal(0); return <button onClick={() => n.set(1)}>{n() ? <b>x</b> : null}</button>; }`,
    nonDelegated: `import { signal } from "@rivetjs/reactivity";\nexport function Card() { const n = signal(0); return <div onScroll={() => n.set(1)}>{n()}</div>; }`,
    moduleSignal: `import { signal } from "@rivetjs/reactivity";\nconst shared = signal(0);\nexport function Card() { const n = signal(0); return <button onClick={() => { n.set(1); shared.set(1); }}>{n()}</button>; }`,
    imported: `import { signal } from "@rivetjs/reactivity";\nimport { step } from "./step.ts";\nexport function Card() { const n = signal(0); return <button onClick={() => n.set(step)}>{n()}</button>; }`,
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

// RT-DIET lite v2: keyed lists (`For`: server rows adopted, new rows from the row spec, removed rows released), `computed`
// locals, local functions, live `class` / `checked`, `model:value`, `submit` / `change` handlers.
const TODOS = `import { signal, computed } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
export function Todos({ n }: { n: number }) {
  const todos = signal([{ id: 1, text: "One", done: true }, { id: 2, text: "Two", done: false }]);
  const draft = signal("");
  const left = computed(() => todos().filter((t) => !t.done).length);
  const label = (count: number) => count + (count === 1 ? " item" : " items");
  return (
    <div class="todos" data-n={n}>
      <form onSubmit={(event) => { event.preventDefault(); const text = draft().trim(); if (!text) return; todos.update((list) => [...list, { id: list.length + 10, text, done: false }]); draft.set(""); }}>
        <input class="new" model:value={draft} />
        <button class="add">Add</button>
      </form>
      <ul>
        <For each={todos} by={(t) => t.id}>
          {(todo, i) => (
            <li class="row">
              <input type="checkbox" class="done" checked={todo().done} onChange={() => todos.update((list) => list.map((t) => (t.id === todo().id ? { ...t, done: !t.done } : t)))} />
              <span class={todo().done ? "text off" : "text"}>{i()}: {todo().text}</span>
              <button class="rm" onClick={() => todos.update((list) => list.filter((t) => t.id !== todo().id))}>x</button>
            </li>
          )}
        </For>
      </ul>
      <p class="left">{label(left())} left</p>
    </div>
  );
}
export function Page() {
  return <main><Todos n={1} /></main>;
}`;
const TODO_RESUME = { module: "src/c.tsx", boundaries: ["Todos"], independent: ["Todos"] };
async function todoFiles(runtime: "lite" | "full" = "lite"): Promise<Record<string, string>> {
  const server = compile(TODOS, { target: "server", filename: "c.tsx", resume: TODO_RESUME } as never);
  const client = compile(TODOS, { target: "dom", filename: "c.tsx", resume: TODO_RESUME } as never);
  assert.deepEqual(server.diagnostics, []);
  assert.ok(client.lite, JSON.stringify((client as { liteBecause?: unknown }).liteBecause));
  const { Page } = await importServer<{ Page: () => ServerValue }>(server.code);
  const rt = runtime === "lite" ? "/lite.js" : "/rt.js";
  const html = (await derivedToString(() => Page(), { manifest: { runtime: rt, symbols: { "src/c.tsx#Todos": "/c.js" } } })) as string;
  return {
    ...DERIVED_BUILD,
    "/": "<!doctype html><html><body>" + html + "</body></html>",
    "/lite.js": 'export { default } from "/dom-lite.ts";',
    "/rt.js": 'export { default } from "/dom-derived.ts";',
    "/c.js": rewrite(client.lite!.code.replace('import("c.tsx")', 'import("/c-full.js")')),
    "/c-full.js": rewrite(client.code),
  };
}
const rows = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("li.row")].map(
      (li) => (li.querySelector(".done") as HTMLInputElement).checked + "|" + li.querySelector("span")!.className + "|" + li.querySelector("span")!.textContent,
    ),
  );

for (const runtime of ["lite", "full"] as const)
  it(`RT-DIET lite v2 (${runtime} runtime): a keyed list, computed, model and form events adopt and update`, async () => {
    await withPage(await todoFiles(runtime), async (page, requests) => {
      await page.goto("http://rivet.test/");
      assert.deepEqual(await rows(page), ["true|text off|0: One", "false|text|1: Two"]);
      assert.equal(await page.textContent(".left"), "1 item left");
      const first = await page.evaluate(() => ((window as { __li?: Element }).__li = document.querySelector("li.row")!) && true);
      assert.ok(first);
      // Cold: the first click boots the lite runtime, which adopts the server rows and replays the click.
      await page.click("li.row:nth-child(1) .done");
      await page.waitForFunction(() => document.querySelector(".left")!.textContent === "2 items left");
      assert.deepEqual(await rows(page), ["false|text|0: One", "false|text|1: Two"]);
      assert.ok(await page.evaluate(() => document.querySelector("li.row") === (window as { __li?: Element }).__li), "server row kept");
      // Add through model + submit: a new row built from the row spec, with its own bindings and handlers.
      await page.fill(".new", "Three");
      await page.click(".add");
      await page.waitForFunction(() => document.querySelectorAll("li.row").length === 3);
      assert.deepEqual(await rows(page), ["false|text|0: One", "false|text|1: Two", "false|text|2: Three"]);
      assert.equal(await page.inputValue(".new"), "");
      await page.click("li.row:nth-child(3) .done");
      await page.waitForFunction(() => document.querySelector(".left")!.textContent === "2 items left");
      assert.deepEqual(await rows(page), ["false|text|0: One", "false|text|1: Two", "true|text off|2: Three"]);
      // Remove the first row: the others move up (index text follows), the removed row's bindings are released.
      await page.click("li.row:nth-child(1) .rm");
      await page.waitForFunction(() => document.querySelectorAll("li.row").length === 2);
      assert.deepEqual(await rows(page), ["false|text|0: Two", "true|text off|1: Three"]);
      assert.equal(await page.textContent(".left"), "1 item left");
      // The list's markers stay balanced (row openers / closers inside the list's own pair).
      const marks = await page.evaluate(() => {
        const out: string[] = [];
        for (const n of document.querySelector("ul")!.childNodes) out.push(n.nodeType == 8 ? (n as Comment).data : (n as Element).localName);
        return out.join(" ");
      });
      assert.equal(marks, "[ r[ li ] r[ li ] ]");
      if (runtime === "lite") assert.ok(!requests.includes("/dom-derived.ts"), requests.join(" "));
      assert.ok(!requests.includes("/c-full.js"), requests.join(" "));
    });
  });

it("RT-DIET lite v2: text typed before adoption survives the model's first run", async () => {
  let release!: () => void;
  const hold = new Promise<void>((resolve) => (release = resolve));
  await withPage(
    await todoFiles(),
    async (page) => {
      await page.goto("http://rivet.test/");
      await page.fill(".new", "Early");
      release();
      await page.waitForFunction(() => (globalThis as { __rivetLite?: unknown }).__rivetLite !== undefined || document.querySelector(".new") !== null);
      await page.click(".add");
      await page.waitForFunction(() => document.querySelectorAll("li.row").length === 3);
      assert.deepEqual((await rows(page))[2], "false|text|2: Early");
    },
    { delays: { "/c.js": hold } },
  );
});
