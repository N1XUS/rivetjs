// Derived model, dependency facts + deferred dependent adopt (DERIVED-C4): with the derived reactivity alias (the Vite
// plugin routes `@rivetjs/reactivity` there in derived builds; here the fixture's import is rewritten), the server notes
// which boundary made and read each plain signal; a heavy dependent child whose subtree is closed is flagged `DEFER` and
// the browser adopts it after its parent at idle / on its own event / before a write its wake lists name, not with the
// parent. Real derived server + DOM targets (skips on a wasm without the model).
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import type { Page } from "playwright";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, rewrite, withPage } from "./resume/harness.ts";

const DEFER = 256,
  MOD = 512;
// App (independent root) holds a plain signal `label` (made by a `.ts` helper, `/helper.js` `make()`: the compiler sees no
// `signal` call, so it does not key it — a module-level helper in the page itself would be keyed) that `List` reads through its props, and a signal that only `Other` reads. Both children make
// eight plain signals of their own (the deferral weight). `Leaky` hands a signal it made to App (escape: adopted with it);
// `Writer` writes App's signal while rendering (adopted with it).
const PAGE = `
import { make } from "/helper.js";
const state = (n) => Array.from({ length: n }, (_, i) => make(i));

export function List(props) {
  const own = state(8);
  return (
    <section id="list">
      <p id="label">{props.label()}</p>
      <button type="button" id="list-own" onClick={() => own[0].set(own[0]() + 1)}>
        {own[0]()}
      </button>
    </section>
  );
}

export function Other(props) {
  const own = state(8);
  return (
    <section id="other">
      <button type="button" id="other-own" onClick={() => own[1].set(own[1]() + 1)}>
        {own[1]()}
      </button>
      <span id="other-shared">{props.shared()}</span>
    </section>
  );
}

export function Leaky(props) {
  const mine = make(1);
  props.take(mine);
  return <i id="leaky">{mine()}</i>;
}

export function Writer(props) {
  props.poke.set(2);
  return <b id="writer">w</b>;
}

export function App() {
  const label = make("one");
  const shared = make(0);
  const poke = make(0);
  let held = null;
  return (
    <main>
      <button type="button" id="rename" onClick={() => label.set("two")}>
        Rename
      </button>
      <button type="button" id="share" onClick={() => shared.set(shared() + 1)}>
        Share
      </button>
      <List label={() => label()} />
      <Other shared={() => shared()} />
      <Leaky take={(s) => (held = s)} />
      <Writer poke={poke} />
      <p id="held">{held ? held() : 0}</p>
    </main>
  );
}
`;
const RESUME = {
  module: "src/page.tsx",
  model: "derived",
  boundaries: ["App", "List", "Other", "Leaky", "Writer"],
  independent: ["App"],
};
const symbols = Object.fromEntries(RESUME.boundaries.map((name) => ["src/page.tsx#" + name, "/page.js"]));
const manifest = { hash: "t", runtime: "/rt.js", symbols };
const serverAlias = JSON.stringify(import.meta.resolve("@rivetjs/runtime/server-derived-reactivity"));
/** The `.ts` helper (not compiled: plain `signal`, through the derived alias or not). */
const helper = (reactivity: string): string => `import { signal } from ${reactivity};\nexport const make = (v) => signal(v);\n`;
const dataUrl = (code: string): string => "data:text/javascript;base64," + Buffer.from(code).toString("base64");

/** The same page with the helper inside it: the compiler keys `make`'s signal (`_rSig`), every boundary's under one key. */
const KEYED = PAGE.replace('import { make } from "/helper.js";', 'import { signal } from "@rivetjs/reactivity";\nconst make = (v) => signal(v);');

async function render(
  alias = true,
  page = PAGE,
): Promise<{ html: string; tail: { b: [number, number, number, string][]; w?: Record<string, number[]>; c?: Record<string, number> } }> {
  const out = compile(page, { target: "server", filename: "page.tsx", resume: RESUME } as never);
  assert.deepEqual(out.diagnostics, []);
  const reactivity = alias ? serverAlias : JSON.stringify(import.meta.resolve("@rivetjs/reactivity"));
  const code = out.code.replaceAll('"@rivetjs/reactivity"', reactivity).replaceAll('"/helper.js"', JSON.stringify(dataUrl(helper(reactivity))));
  const { App } = await importServer<{ App: () => ServerValue }>(code);
  const html = (await derivedToString(() => App(), { manifest })) as string;
  return { html, tail: JSON.parse(/<script type="rivet\/boundaries"[^>]*>(.*?)<\/script>/s.exec(html)![1]!) };
}
const flagsOf = (tail: Awaited<ReturnType<typeof render>>["tail"], name: string): number => tail.b.find((r) => r[3] === "src/page.tsx#" + name)![2];

const compiled = hasDerivedModel() ? test : test.skip;

compiled("server: closed heavy dependents defer, an escaping / writing one does not; wake keys + counts name the plain signals", async () => {
  const { tail } = await render();
  assert.ok(flagsOf(tail, "List") & DEFER, "List defers");
  assert.ok(flagsOf(tail, "Other") & DEFER, "Other defers");
  assert.equal(flagsOf(tail, "List") & MOD, 0);
  assert.equal(flagsOf(tail, "Leaky") & DEFER, 0, "Leaky: its signal escaped to App");
  assert.equal(flagsOf(tail, "Writer") & DEFER, 0, "Writer: wrote App's signal");
  assert.equal(flagsOf(tail, "App") & DEFER, 0, "independent: deferred anyway");
  const app = tail.b.find((r) => r[3] === "src/page.tsx#App")![0],
    list = tail.b.find((r) => r[3] === "src/page.tsx#List")![0],
    other = tail.b.find((r) => r[3] === "src/page.tsx#Other")![0];
  // label = App's signal 0, shared = 1: read by List / Other only.
  assert.deepEqual(tail.w?.[app + ".$0"], [list]);
  assert.deepEqual(tail.w?.[app + ".$1"], [other]);
  assert.equal(tail.c?.[app], 3);
  // Without the alias (no dependency facts): nothing defers.
  const plain = await render(false);
  for (const name of ["List", "Other"]) assert.equal(flagsOf(plain.tail, name) & DEFER, 0, name + " without facts");
});

async function files(page = PAGE): Promise<Record<string, string>> {
  const { html } = await render(true, page);
  const dom = compile(page, { target: "dom", filename: "page.tsx", resume: RESUME } as never);
  assert.deepEqual(dom.diagnostics, []);
  return {
    ...DERIVED_BUILD,
    "/": "<!doctype html><html><body>" + html + "</body></html>",
    "/rt.js": 'export { default } from "/dom-derived.ts";',
    "/page.js": rewrite(dom.code.replaceAll('"@rivetjs/reactivity"', '"/derived-reactivity.ts"')),
    "/helper.js": helper('"/derived-reactivity.ts"'),
  };
}
const attached = (page: Page, selector: string): Promise<boolean> =>
  page.evaluate((s) => (document.querySelector(s) as unknown as Record<string, unknown>).$$click !== undefined, selector);

compiled("browser: an event in one deferred child adopts it alone; a write its wake key names adopts the reader first", async () => {
  await withPage(await files(), async (page) => {
    // Idle adoption off: the deferred children wait for their own event / wake.
    await page.addInitScript(() => void ((window as unknown as Record<string, unknown>).requestIdleCallback = () => 0));
    await page.goto("http://rivet.test/");
    const nodes = await page.evaluate(() =>
      ["#list-own", "#other-own", "#label"].map((s) => ((document.querySelector(s) as unknown as Record<string, number>).__t = 1)),
    );
    assert.equal(nodes.length, 3);
    await page.click("#other-own");
    await page.waitForFunction(() => document.querySelector("#other-own")!.textContent === "2");
    assert.equal(await attached(page, "#other-own"), true);
    assert.equal(await attached(page, "#list-own"), false, "List stays deferred");
    // App's write to `label` (List's wake key): List adopts over its server nodes, then the write lands.
    await page.click("#rename");
    await page.waitForFunction(() => document.querySelector("#label")!.textContent === "two");
    assert.equal(await attached(page, "#list-own"), true);
    assert.deepEqual(
      await page.evaluate(() => ["#list-own", "#other-own", "#label"].map((s) => (document.querySelector(s) as unknown as Record<string, number>).__t)),
      [1, 1, 1],
      "server nodes kept",
    );
    await page.click("#share");
    await page.waitForFunction(() => document.querySelector("#other-shared")!.textContent === "1");
  });
});

compiled("browser: deferred children adopt at idle; a count that differs from the server's adopts the readers at once", async () => {
  await withPage(await files(), async (page) => {
    await page.goto("http://rivet.test/");
    await page.click("#share");
    await page.waitForFunction(() => document.querySelector("#other-shared")!.textContent === "1");
    await page.waitForFunction(() => (document.querySelector("#list-own") as unknown as Record<string, unknown>).$$click !== undefined);
  });
  const served = await files();
  // The server's count for App off by one: List / Other (App's readers) adopt with App.
  served["/"] = served["/"]!.replace(/"c":\{"(\d+)":3\}/, '"c":{"$1":4}');
  await withPage(served, async (page) => {
    await page.addInitScript(() => void ((window as unknown as Record<string, unknown>).requestIdleCallback = () => 0));
    await page.goto("http://rivet.test/");
    await page.click("#rename");
    await page.waitForFunction(() => document.querySelector("#label")!.textContent === "two");
    assert.equal(await attached(page, "#other-own"), true, "Other adopted with App (count differs)");
  });
});

compiled("browser: cyclic wake lists (App reads Leaky's keyed signal, List reads App's) adopt without recursing", async () => {
  // DERIVED-C5: `need` walked App → its source Leaky → Leaky's parent App … (stack overflow, the page reloaded).
  const { tail } = await render(true, KEYED);
  const id = (name: string): number => tail.b.find((r) => r[3] === "src/page.tsx#" + name)![0];
  assert.ok(Object.entries(tail.w ?? {}).some(([key, readers]) => key.startsWith(id("Leaky") + ".") && readers.includes(id("App"))));
  await withPage(await files(KEYED), async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.exposeFunction("__resumeError", (message: string) => errors.push(message));
    await page.addInitScript(() =>
      document.addEventListener("rivet:resume-error", (e) => {
        e.preventDefault();
        (window as unknown as { __resumeError(m: string): void }).__resumeError(String((e as CustomEvent).detail));
      }),
    );
    await page.goto("http://rivet.test/");
    await page.click("#other-own");
    await page.waitForFunction(() => document.querySelector("#other-own")!.textContent === "2");
    await page.click("#rename");
    await page.waitForFunction(() => document.querySelector("#label")!.textContent === "two");
    assert.deepEqual(errors, []);
  });
});

// A form's submit validates its controls: their `invalid` listeners (attached from a ref, as cdk hooks do: no delegated
// type covers them) must exist by then — the deferred unit inside the form adopts before the submit's default runs.
const FORM = `
import { make } from "/helper.js";

export function Field() {
  const own = Array.from({ length: 8 }, (_, i) => make(i));
  const bad = make(false);
  return (
    <label id="field" data-invalid={bad() ? "" : undefined}>
      <input id="terms" name="terms" type="checkbox" required ref={(el) => el.addEventListener("invalid", () => bad.set(true))} />
      {own[0]()}
    </label>
  );
}

export function Page() {
  const count = make(0);
  return (
    <div>
      <button type="button" id="other" onClick={() => count.set(count() + 1)}>
        {count()}
      </button>
      <form id="form" onSubmit={(e) => e.preventDefault()}>
        <Field />
        <button type="submit" id="go">
          Go
        </button>
      </form>
    </div>
  );
}
`;
const FORM_RESUME = { module: "src/page.tsx", model: "derived", boundaries: ["Page", "Field"], independent: ["Page"] };

compiled("browser: a submit adopts the deferred units inside its form first (their invalid listeners run)", async () => {
  const reactivity = serverAlias;
  const out = compile(FORM, { target: "server", filename: "page.tsx", resume: FORM_RESUME } as never);
  assert.deepEqual(out.diagnostics, []);
  const { Page } = await importServer<{ Page: () => ServerValue }>(
    out.code.replaceAll('"@rivetjs/reactivity"', reactivity).replaceAll('"/helper.js"', JSON.stringify(dataUrl(helper(reactivity)))),
  );
  const symbols = Object.fromEntries(FORM_RESUME.boundaries.map((name) => ["src/page.tsx#" + name, "/page.js"]));
  const html = (await derivedToString(() => Page(), { manifest: { hash: "t", runtime: "/rt.js", symbols } })) as string;
  const tail = JSON.parse(/<script type="rivet\/boundaries"[^>]*>(.*?)<\/script>/s.exec(html)![1]!) as { b: [number, number, number, string][] };
  assert.ok(tail.b.find((r) => r[3] === "src/page.tsx#Field")![2] & DEFER, "Field defers");
  const dom = compile(FORM, { target: "dom", filename: "page.tsx", resume: FORM_RESUME } as never);
  assert.deepEqual(dom.diagnostics, []);
  const served = {
    ...DERIVED_BUILD,
    "/": "<!doctype html><html><body>" + html + "</body></html>",
    "/rt.js": 'export { default } from "/dom-derived.ts";',
    "/page.js": rewrite(dom.code.replaceAll('"@rivetjs/reactivity"', '"/derived-reactivity.ts"')),
    "/helper.js": helper('"/derived-reactivity.ts"'),
  };
  // Cold (the first click adopts Page, Field stays deferred) and hot (the runtime runs already: a first click elsewhere).
  for (const warm of [false, true])
    await withPage(served, async (page) => {
      await page.addInitScript(() => void ((window as unknown as Record<string, unknown>).requestIdleCallback = () => 0));
      await page.goto("http://rivet.test/");
      if (warm) {
        await page.click("#other");
        await page.waitForFunction(() => document.querySelector("#other")!.textContent === "1");
        assert.equal(await page.evaluate(() => document.querySelector("#field")!.hasAttribute("data-invalid")), false);
      }
      await page.click("#go");
      await page.waitForFunction(() => document.querySelector("#field")!.hasAttribute("data-invalid"));
    });
});
