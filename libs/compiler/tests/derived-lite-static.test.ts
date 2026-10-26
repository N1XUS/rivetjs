// RT-DIET2 (2026-10-26): static component children inside lite residuals (`rust/src/compile/derived_lite_static.rs`): a
// component child whose props are static closed-world values (an `Icon` in a button) is skipped over its marker pair;
// a `For` row holding one has spec `0`: the rows the browser builds are copies of the first server row
// (`runtime/dom-lite-list.ts` `_lf`). End to end against the real derived server target and the lite runtime.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile, hasDerivedModel } from "../index.ts";
import type { ServerValue } from "../../runtime/server.ts";
import { derivedToString } from "../../runtime/server-derived.ts";
import { importServer } from "../../runtime/tests/resume/compile.ts";
import { DERIVED_BUILD, rewrite, withPage } from "../../runtime/tests/resume/harness.ts";
import type { Page } from "playwright";

const it = hasDerivedModel() ? test : test.skip;
const RESUME = { module: "src/c.tsx", boundaries: ["Cart"], independent: ["Cart"] };
const dom = (source: string) => compile(source, { target: "dom", filename: "c.tsx", resume: RESUME } as never);
const why = (out: unknown) => {
  const map = (out as { liteBecause?: Record<string, string> }).liteBecause;
  return map?.["src/c.tsx#Cart"] ?? map?.Cart;
};

const CART = `import { signal, computed } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
const PLUS = [["path", { d: "M5 12h14" }], ["path", { d: "M12 5v14" }]];
function Icon(props: { icon: [string, Record<string, string>][]; size?: number }) {
  return <svg class="i" width={props.size ?? 16} viewBox="0 0 24 24">{props.icon.map(([, attrs]) => <path d={attrs.d} />)}</svg>;
}
export function Cart() {
  const lines = signal([{ id: "tea", qty: 1 }, { id: "cake", qty: 2 }]);
  const total = computed(() => lines().reduce((sum, line) => sum + line.qty, 0));
  return (
    <div class="cart">
      <button type="button" class="new" onClick={() => lines.update((all) => [...all, { id: "n" + all.length, qty: 0 }])}>
        <Icon icon={PLUS} size={12} /> New
      </button>
      <ul>
        <For each={lines} by={(line) => line.id}>
          {(line) => (
            <li class="row">
              <span class="name">{line().id}</span>
              <button type="button" class="add" onClick={() => lines.update((all) => all.map((l) => (l.id === line().id ? { ...l, qty: l.qty + 1 } : l)))}>
                <Icon icon={PLUS} />
              </button>
              <span class="qty">{line().qty}</span>
            </li>
          )}
        </For>
      </ul>
      <p class="total">{total()}</p>
    </div>
  );
}
export function Page() {
  return <main><Cart /></main>;
}`;

it("RT-DIET2: a static component child is skipped over its markers; a row holding one has spec `0` (copies of a server row)", () => {
  const out = dom(CART);
  assert.deepEqual(out.diagnostics, []);
  assert.ok(out.lite, JSON.stringify((out as { liteBecause?: unknown }).liteBecause));
  const code = out.lite.code.replace(/\s+/g, " ");
  assert.ok(!code.includes("Icon") && !code.includes("PLUS"), code);
  assert.match(code, /\}, 0\);/);
});

it("RT-DIET2: a component child with a live, function or JSX prop, or children, keeps the ordinary adopt", () => {
  const base = (child: string) => `import { signal } from "@rivetjs/reactivity";
function Icon(props: { n?: number; on?: () => void; children?: unknown }) { return <i>{props.n}</i>; }
export function Cart() { const n = signal(0); return <button onClick={() => n.set(n() + 1)}>${child}</button>; }`;
  const cases: Record<string, string> = {
    live: "<Icon n={n()} />",
    fn: "<Icon on={() => 1} />",
    jsx: "<Icon n={<b /> as never} />",
    children: "<Icon>x</Icon>",
    spread: "<Icon {...{ n: 1 }} />",
  };
  for (const [name, child] of Object.entries(cases)) {
    const out = dom(base(child));
    assert.equal(out.lite, undefined, `${name}: ${out.lite?.code}`);
    assert.ok(why(out), name);
  }
  // A literal prop, a module constant and a bare boolean are static.
  const out = dom(base("<Icon n={2} /> {n()}"));
  assert.ok(out.lite, JSON.stringify((out as { liteBecause?: unknown }).liteBecause));
});

async function files(): Promise<Record<string, string>> {
  const server = compile(CART, { target: "server", filename: "c.tsx", resume: RESUME } as never);
  const client = dom(CART);
  assert.deepEqual(server.diagnostics, []);
  const { Page } = await importServer<{ Page: () => ServerValue }>(server.code);
  const html = (await derivedToString(() => Page(), { manifest: { runtime: "/lite.js", symbols: { "src/c.tsx#Cart": "/c.js" } } })) as string;
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
      (li) => li.querySelector(".name")!.textContent + "=" + li.querySelector(".qty")!.textContent + "|" + li.querySelectorAll(".add svg.i path").length,
    ),
  );

it("RT-DIET2 end to end (lite runtime): rows with an icon adopt, update, and new rows carry the copied icon", async () => {
  await withPage(await files(), async (page, requests) => {
    await page.goto("http://rivet.test/");
    assert.deepEqual(await rows(page), ["tea=1|2", "cake=2|2"]);
    await page.click("li.row:nth-child(2) .add");
    await page.waitForFunction(() => document.querySelector(".total")!.textContent === "4");
    assert.deepEqual(await rows(page), ["tea=1|2", "cake=3|2"]);
    await page.click(".new");
    await page.waitForFunction(() => document.querySelectorAll("li.row").length === 3);
    assert.deepEqual(await rows(page), ["tea=1|2", "cake=3|2", "n2=0|2"]);
    await page.click("li.row:nth-child(3) .add");
    await page.waitForFunction(() => document.querySelector(".total")!.textContent === "5");
    assert.deepEqual(await rows(page), ["tea=1|2", "cake=3|2", "n2=1|2"]);
    assert.ok(!requests.includes("/dom-derived.ts") && !requests.includes("/c-full.js"), requests.join(" "));
  });
});
