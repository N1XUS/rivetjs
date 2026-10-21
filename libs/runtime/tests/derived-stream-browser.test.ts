// Derived model, streamed holes (DERIVED-C2): an `Async` with a fallback whose load is pending writes `<!--a<id>-->…<!--/a-->`
// and a tail / patch entry (`a`: its unit, its place, then its value). Awaited in place (no stream), the content and its
// value are in the shell; streamed (`renderDerived` with `stream`), the fallback is, and the content follows as a segment
// (`<template data-a>` + patch + `$rD`). The browser's adopt run makes that `Async` a hole and adopts its content with the
// server's value — its `load` never runs — whether the segment landed before the runtime started or after the unit adopted.
// Compiled with the real derived server + DOM targets (skips on a wasm without the model).
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString, renderDerived } from "@rivetjs/runtime/server-derived";
import type { Page } from "playwright";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, rewrite, withPage } from "./resume/harness.ts";

const compiled = hasDerivedModel() ? test : test.skip;
const PAGE = `import { signal } from "@rivetjs/reactivity";
import { Async } from "@rivetjs/runtime/dom";
export function Inner(props: { label: string }) {
  const n = signal(0);
  return <button id={"inner-" + props.label} onClick={() => n.set(n() + 1)}>{props.label + n()}</button>;
}
export function App(props: { data: PromiseLike<{ items: string[] }> }) {
  const count = signal(0);
  const picked = signal("none");
  return (
    <section>
      <button id="count" onClick={() => count.set(count() + 1)}>{count()}</button>
      <Async load={() => ((globalThis as { loads?: number }).loads = ((globalThis as { loads?: number }).loads ?? 0) + 1, props.data)} fallback={() => <p id="wait">wait</p>}>
        {(value) => (
          <div id="list">
            <ul>
              {value.items.map((item) => (
                <li>
                  <button onClick={() => picked.set(item)}>{item}</button>
                </li>
              ))}
            </ul>
            <Inner label="x" />
          </div>
        )}
      </Async>
      <p id="picked">{picked()}</p>
    </section>
  );
}
`;
const RESUME = { module: "src/page.tsx", model: "derived", boundaries: ["App", "Inner"], independent: ["App"] };
const manifest = { hash: "t", runtime: "/rt.js", symbols: { "src/page.tsx#App": "/page.js", "src/page.tsx#Inner": "/page.js" } };
const ITEMS = { items: ["Io", "Europa"] };

async function build(): Promise<{ App: (props: { data: PromiseLike<unknown> }) => ServerValue; dom: string }> {
  const server = compile(PAGE, { target: "server", filename: "page.tsx", resume: RESUME } as never);
  const dom = compile(PAGE, { target: "dom", filename: "page.tsx", resume: RESUME } as never);
  assert.deepEqual(server.diagnostics, []);
  assert.deepEqual(dom.diagnostics, []);
  const { App } = await importServer<{ App: (props: { data: PromiseLike<unknown> }) => ServerValue }>(server.code);
  return { App, dom: rewrite(dom.code) };
}
const files = (html: string, dom: string): Record<string, string> => ({
  ...DERIVED_BUILD,
  "/": "<!doctype html><html><body>" + html + "</body></html>",
  "/rt.js": 'export { default } from "/dom-derived.ts";',
  "/page.js": dom,
});
/** `renderDerived` with `stream` into chunks; `gate` holds the load until released. */
async function streamed(App: (props: { data: PromiseLike<unknown> }) => ServerValue, gate: Promise<void>, deadline?: number): Promise<string[]> {
  const chunks: string[] = [];
  const data = gate.then(() => ITEMS);
  await renderDerived(
    () => App({ data }),
    { write: (chunk: string) => void chunks.push(chunk) },
    { manifest, stream: deadline === undefined ? {} : { deadline } },
  );
  return chunks;
}
const tag = (page: Page, selectors: string[]): Promise<void> =>
  page.evaluate((list) => list.forEach((s, i) => ((document.querySelector(s) as unknown as Record<string, number>).__t = i + 1)), selectors);
const tagged = (page: Page, selectors: string[]): Promise<boolean[]> =>
  page.evaluate((list) => list.map((s, i) => (document.querySelector(s) as unknown as Record<string, number> | null)?.__t === i + 1), selectors);
const text = (page: Page, selector: string): Promise<string | null> => page.textContent(selector);

compiled("server: awaited in place — markers around the content, the value in the shell's tail", async () => {
  const { App } = await build();
  const html = (await derivedToString(() => App({ data: Promise.resolve(ITEMS) }), { manifest })) as string;
  assert.match(html, /<!--a1--><div id="list">.*<\/div><!--\/a-->/s);
  const tail = JSON.parse(/<script type="rivet\/boundaries"[^>]*>(.*?)<\/script>/s.exec(html)![1]!);
  assert.deepEqual(tail.a, [[1, 1, 0, 1, ITEMS]]);
  assert.ok(!html.includes("$rD"), "no stream add-on without streaming");
});

compiled("server: streamed — fallback in the shell (entry pending), the content as a segment with its value and records", async () => {
  const { App } = await build();
  const chunks = await streamed(App, Promise.resolve());
  const html = chunks.join("");
  const shell = html.slice(0, html.indexOf("<template"));
  assert.match(shell, /<!--a1--><p id="wait">wait<\/p><!--\/a-->/);
  assert.deepEqual(JSON.parse(/<script type="rivet\/boundaries" data-rt[^>]*>(.*?)<\/script>/s.exec(shell)![1]!).a, [[1, 1, 0]]);
  assert.equal(html.match(/window\.\$rD=/g)?.length, 1, "the swap add-on once");
  const patch = JSON.parse(/<script type="rivet\/boundaries" data-patch="1">(.*?)<\/script>/s.exec(html)![1]!);
  assert.deepEqual(patch.a, [[1, 1, 0, 1, ITEMS]]);
  // The content's boundary (Inner) is numbered on from the shell's.
  assert.deepEqual(
    patch.b.map((r: unknown[]) => r.slice(0, 4)),
    [[2, 1, 2, "src/page.tsx#Inner"]],
  );
  assert.match(
    html,
    /<template data-a="1"><div id="list">.*<\/template><script type="rivet\/boundaries" data-patch="1">.*<\/script><script>\$rD\(1\)<\/script>$/s,
  );
});

compiled("server: a stream cut by its deadline leaves the boundary to the browser (no template, entry without a value)", async () => {
  const { App } = await build();
  const chunks = await streamed(App, new Promise(() => {}), 10);
  const html = chunks.join("");
  assert.ok(!html.includes("<template"));
  assert.deepEqual(JSON.parse(/data-patch="1">(.*?)<\/script>/s.exec(html)![1]!).a, [[1, 1, 0, 0]]);
});

compiled("awaited in place: the content adopts with the server's value (its load never runs in the browser)", async () => {
  const { App, dom } = await build();
  const html = (await derivedToString(() => App({ data: Promise.resolve(ITEMS) }), { manifest })) as string;
  await withPage(files(html, dom), async (page) => {
    await page.goto("http://rivet.test/");
    await tag(page, ["#list", "li:nth-child(2) button", "#inner-x"]);
    await page.click("li:nth-child(2) button");
    await page.waitForFunction(() => document.querySelector("#picked")!.textContent === "Europa");
    assert.deepEqual(await tagged(page, ["#list", "li:nth-child(2) button", "#inner-x"]), [true, true, true], "server nodes kept");
    // The content's own boundary adopts too (a child of the content unit).
    await page.click("#inner-x");
    await page.waitForFunction(() => document.querySelector("#inner-x")!.textContent === "x1");
    await page.click("#count");
    assert.equal(await text(page, "#count"), "1");
    assert.equal(await page.evaluate(() => (globalThis as { loads?: number }).loads ?? 0), 0, "its load never ran in the browser");
  });
});

compiled("streamed, landed before the runtime started: the swapped-in content adopts", async () => {
  const { App, dom } = await build();
  const html = (await streamed(App, Promise.resolve())).join("");
  await withPage(files(html, dom), async (page) => {
    await page.goto("http://rivet.test/");
    assert.equal(await page.$("#wait"), null, "the segment replaced the fallback");
    await tag(page, ["#list", "li:nth-child(1) button"]);
    await page.click("li:nth-child(1) button");
    await page.waitForFunction(() => document.querySelector("#picked")!.textContent === "Io");
    assert.deepEqual(await tagged(page, ["#list", "li:nth-child(1) button"]), [true, true]);
  });
});

compiled("streamed, landing after the unit adopted over its fallback: the hole waits, then adopts the content", async () => {
  const { App, dom } = await build();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const data = gate.then(() => ITEMS);
  await withPage(
    files("", dom),
    async (page) => {
      await page.goto("http://rivet.test/", { waitUntil: "commit" });
      await page.waitForSelector("#wait");
      await page.click("#count");
      await page.waitForFunction(() => document.querySelector("#count")!.textContent === "1");
      // The unit adopted with the fallback showing; now the segment lands.
      release();
      await page.waitForSelector("#list");
      await tag(page, ["#list"]);
      await page.click("li:nth-child(2) button");
      await page.waitForFunction(() => document.querySelector("#picked")!.textContent === "Europa");
      assert.deepEqual(await tagged(page, ["#list"]), [true], "the segment's nodes adopted");
      await page.click("#count");
      assert.equal(await text(page, "#count"), "2");
      assert.equal(await page.evaluate(() => (globalThis as { loads?: number }).loads ?? 0), 0, "its load never ran in the browser");
    },
    {
      streams: {
        // The shell as it renders, the segment once the test releases the load.
        "/": (_request, response) => {
          response.writeHead(200, { "content-type": "text/html" });
          response.write("<!doctype html><html><body>");
          void Promise.resolve(renderDerived(() => App({ data }), { write: (chunk: string) => void response.write(chunk) }, { manifest, stream: {} })).then(
            () => response.end("</body></html>"),
          );
        },
      },
    },
  );
});
