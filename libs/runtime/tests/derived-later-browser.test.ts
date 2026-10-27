// Derived model, lazy-part prefetch (IDLE-PREFETCH 2026-10-27): the manifest's `lazy` edges (chunk → the chunks of its
// `lazyComponent(() => import(…))` parts) that the page's fetch-ahead list reaches become the tail's `data-fl` (+ their
// static closures, minus the fetch-ahead list), and only such pages ship the lazy-part loader (`DERIVED_LOADER_LATER`).
// In the browser the lazy parts are low-priority modulepreloads appended once every fetch-ahead link loaded, in the next
// idle period: never before the fetch-ahead list is in, never evaluated, a later `import()` fetches nothing; none under
// Save-Data; on `intent` pages they follow the intent's fetch-ahead list.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import { DERIVED_LOADER, DERIVED_LOADER_LATER } from "../resume-loader-derived.min.ts";
import type { Page } from "playwright";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, rewrite, withPage } from "./resume/harness.ts";

const SOURCE = `import { signal } from "@rivetjs/reactivity";
export function Root() {
  return (
    <main>
      <Inner start={1} />
    </main>
  );
}
export function Inner(props) {
  const n = signal(props.start);
  return <button id="inner" onClick={() => n.set(n() + 1)}>{n()}</button>;
}
`;
const compiled = hasDerivedModel() ? test : test.skip;
const resume = { module: "src/page.tsx", boundaries: ["Root", "Inner"], independent: ["Root", "Inner"] };
const symbols = { "src/page.tsx#Root": "/root.js", "src/page.tsx#Inner": "/inner.js" };
// `/inner.js` imports `/shared.js` statically and the lazy part `/part.js` (closure `/part-dep.js`, `/shared.js`) dynamically;
// `/part.js` has its own lazy part `/nested.js`.
const LAZY = { "/inner.js": ["/part.js"], "/part.js": ["/nested.js"] };
const DEPS = { "/inner.js": ["/shared.js"], "/part.js": ["/part-dep.js", "/shared.js"] };

async function render(manifest: object = {}, preload?: object): Promise<string> {
  const server = compile(SOURCE, { target: "server", filename: "page.tsx", resume } as never);
  assert.deepEqual(server.diagnostics, []);
  const { Root } = await importServer<{ Root: () => ServerValue }>(server.code);
  return (await derivedToString(() => Root(), {
    manifest: { hash: "t", runtime: "/rt.js", symbols, deps: DEPS, ...manifest },
    ...(preload ? { preload } : {}),
  } as never)) as string;
}
function site(html: string): Record<string, string> {
  const dom = compile(SOURCE, { target: "dom", filename: "page.tsx", resume } as never);
  assert.deepEqual(dom.diagnostics, []);
  const code = rewrite(dom.code);
  const mark = (name: string) => `window.__eval = (window.__eval || []).concat(${JSON.stringify(name)});`;
  return {
    ...DERIVED_BUILD,
    "/": "<!doctype html><html><body>" + html + "</body></html>",
    "/rt.js": 'export { default } from "/dom-derived.ts";',
    "/root.js": code,
    "/inner.js": code,
    "/shared.js": mark("shared"),
    "/part.js": 'import "/part-dep.js";\nimport "/shared.js";\n' + mark("part") + "\nexport const part = 1;",
    "/part-dep.js": mark("part-dep"),
    "/nested.js": mark("nested"),
  };
}
const attr = (html: string, name: string): string[] | undefined => new RegExp(`\\b${name}="([^"]*)"`).exec(html)?.[1]!.split(" ");
const links = (page: Page) =>
  page.$$eval('link[rel="modulepreload"]', (list) => list.map((l) => [l.getAttribute("href"), (l as HTMLLinkElement).fetchPriority]));
const evaluated = (page: Page) => page.evaluate(() => (window as unknown as { __eval?: string[] }).__eval ?? []);

compiled(
  "lazy parts: data-fl = the lazy parts the fetch-ahead list reaches (+ closures, minus the list); only such pages ship the lazy-part loader",
  async () => {
    const plain = await render(),
      lazy = await render({ lazy: LAZY });
    assert.deepEqual(attr(lazy, "data-fo"), ["/rt.js", "/inner.js", "/shared.js"]);
    assert.deepEqual(attr(lazy, "data-fl"), ["/part.js", "/part-dep.js", "/nested.js"], "transitive, closures included, the list's /shared.js left out");
    assert.ok(lazy.includes(DERIVED_LOADER_LATER) && !plain.includes(DERIVED_LOADER_LATER));
    // A page without lazy parts: no attribute, the plain loader (0 bytes for pages that use none).
    assert.equal(attr(plain, "data-fl"), undefined);
    assert.ok(plain.includes(DERIVED_LOADER));
    // An edge from a chunk the page does not fetch ahead, or to a chunk already in the list: nothing later.
    assert.equal(attr(await render({ lazy: { "/other.js": ["/part.js"] } }), "data-fl"), undefined);
    assert.equal(attr(await render({ lazy: { "/inner.js": ["/shared.js"] } }), "data-fl"), undefined);
    // Every fetch-ahead mode lists them.
    assert.deepEqual(attr(await render({ lazy: LAZY }, { ahead: "intent" }), "data-fl"), ["/part.js", "/part-dep.js", "/nested.js"]);
  },
);

compiled(
  "lazy parts: idle preloads them at low priority only after the fetch-ahead list loaded, evaluating nothing; an import fetches nothing more",
  async () => {
    const html = await render({ lazy: LAZY });
    const requests: string[] = [];
    await withPage(
      site(html),
      async (page, seen) => {
        await page.goto("http://rivet.test/");
        // The fetch-ahead list is out, `/shared.js` (in it) still loading: no lazy part yet.
        await page.waitForFunction(() => document.querySelectorAll('link[rel="modulepreload"]').length === 3);
        await page.waitForTimeout(150);
        assert.deepEqual(await links(page), [
          ["/rt.js", "low"],
          ["/inner.js", "low"],
          ["/shared.js", "low"],
        ]);
        assert.ok(!seen.includes("/part.js"), "not before the fetch-ahead list loaded");
        // Once it loaded: the lazy parts, low priority, after the list.
        await page.waitForFunction(() => document.querySelectorAll('link[rel="modulepreload"]').length === 6);
        assert.deepEqual((await links(page)).slice(3), [
          ["/part.js", "low"],
          ["/part-dep.js", "low"],
          ["/nested.js", "low"],
        ]);
        await page.waitForFunction(() =>
          [...document.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"]')].every((l) => performance.getEntriesByName(l.href).length > 0),
        );
        assert.deepEqual(await evaluated(page), [], "fetched + compiled, never evaluated");
        const before = seen.filter((path) => path === "/part.js").length;
        assert.equal(before, 1);
        // The part's `lazyComponent` import on use: evaluated from the module map, no second request.
        await page.evaluate(() => import("/part.js" as string));
        assert.deepEqual((await evaluated(page)).sort(), ["part", "part-dep", "shared"]);
        assert.equal(seen.filter((path) => path === "/part.js" || path === "/part-dep.js").length, 2);
        // The page still works (the plain loader's behaviour is unchanged).
        await page.click("#inner");
        await page.waitForFunction(() => document.querySelector("#inner")!.textContent === "2");
        requests.push(...seen);
      },
      { delays: { "/shared.js": 600 } },
    );
    assert.ok(requests.indexOf("/part.js") > requests.indexOf("/shared.js"));
  },
);

compiled("lazy parts: none under Save-Data (intent still fetches the fetch-ahead list); intent pages fetch them after the intent's list", async () => {
  const idle = await render({ lazy: LAZY });
  await withPage(site(idle), async (page, requests) => {
    await page.addInitScript(() => Object.defineProperty(navigator, "connection", { value: { saveData: true }, configurable: true }));
    await page.goto("http://rivet.test/");
    await page.click("#inner");
    await page.waitForFunction(() => document.querySelector("#inner")!.textContent === "2");
    await page.waitForFunction(() =>
      [...document.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"]')].every((l) => performance.getEntriesByName(l.href).length > 0),
    );
    await page.waitForTimeout(300);
    assert.deepEqual(await links(page), [
      ["/rt.js", "high"],
      ["/inner.js", "high"],
      ["/shared.js", "high"],
    ]);
    assert.ok(!requests.includes("/part.js"), "Save-Data: no lazy part");
  });
  const intent = await render({ lazy: LAZY }, { ahead: "intent" });
  await withPage(site(intent), async (page, requests) => {
    await page.goto("http://rivet.test/");
    await page.waitForTimeout(300);
    assert.deepEqual(await links(page), [], "no JS before input");
    assert.ok(!requests.includes("/rt.js") && !requests.includes("/part.js"));
    await page.click("#inner");
    await page.waitForFunction(() => document.querySelector("#inner")!.textContent === "2");
    await page.waitForFunction(() => document.querySelectorAll('link[rel="modulepreload"]').length === 6);
    assert.deepEqual(await links(page), [
      ["/rt.js", "high"],
      ["/inner.js", "high"],
      ["/shared.js", "high"],
      ["/part.js", "low"],
      ["/part-dep.js", "low"],
      ["/nested.js", "low"],
    ]);
  });
});
