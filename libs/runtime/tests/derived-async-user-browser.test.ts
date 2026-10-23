// Derived model, M6-PARITY task 4: an app `<Async>` without a fallback function and an `Async` in `<For>` rows resume.
// Without a fallback the server awaits the content in place (also while streaming) between `<!--a<id>-->…<!--/a-->` with
// its value in the tail; the browser adopts it without running `load`. In a row the hole takes its id from the marker it
// claims (the server numbers a boundary's `Async`s across its rows, a row unit counts from 0). Real derived targets (skips
// on a wasm without the model).
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
import { Async, For } from "@rivetjs/runtime/dom";
type Data = { items: string[] };
const bump = () => ((globalThis as { loads?: number }).loads = ((globalThis as { loads?: number }).loads ?? 0) + 1);
export function Plain(props: { data: PromiseLike<Data> }) {
  const picked = signal("none");
  return (
    <section>
      <Async load={() => (bump(), props.data)}>
        {(value) => (
          <ul id="list">
            {value.items.map((item) => (
              <li>
                <button onClick={() => picked.set(item)}>{item}</button>
              </li>
            ))}
          </ul>
        )}
      </Async>
      <p id="picked">{picked()}</p>
    </section>
  );
}
export function Rows(props: { load: (id: number) => PromiseLike<string>; fallback: boolean }) {
  const rows = signal([1, 2, 3]);
  const picked = signal("none");
  return (
    <section>
      <ul>
        <For each={() => rows()} by={(x) => x}>
          {(x) => (
            <li id={"row-" + x()}>
              {props.fallback ? (
                <Async load={() => (bump(), props.load(x()))} fallback={() => <i>wait</i>}>
                  {(text) => <button class="pick" onClick={() => picked.set(text)}>{text}</button>}
                </Async>
              ) : (
                <Async load={() => (bump(), props.load(x()))}>
                  {(text) => <button class="pick" onClick={() => picked.set(text)}>{text}</button>}
                </Async>
              )}
            </li>
          )}
        </For>
      </ul>
      <p id="picked">{picked()}</p>
    </section>
  );
}
`;
const RESUME = { module: "src/page.tsx", boundaries: ["Plain", "Rows"], independent: ["Plain", "Rows"] };
const manifest = { hash: "t", runtime: "/rt.js", symbols: { "src/page.tsx#Plain": "/page.js", "src/page.tsx#Rows": "/page.js" } };
const ITEMS = { items: ["Io", "Europa"] };
type Mod = {
  Plain: (props: { data: PromiseLike<unknown> }) => ServerValue;
  Rows: (props: { load: (id: number) => PromiseLike<string>; fallback: boolean }) => ServerValue;
};
async function build(): Promise<Mod & { dom: string }> {
  const server = compile(PAGE, { target: "server", filename: "page.tsx", resume: RESUME } as never);
  const dom = compile(PAGE, { target: "dom", filename: "page.tsx", resume: RESUME } as never);
  assert.deepEqual(server.diagnostics, []);
  assert.deepEqual(dom.diagnostics, []);
  return { ...(await importServer<Mod>(server.code)), dom: rewrite(dom.code) };
}
const files = (html: string, dom: string): Record<string, string> => ({
  ...DERIVED_BUILD,
  "/": "<!doctype html><html><body>" + html + "</body></html>",
  "/rt.js": 'export { default } from "/dom-derived.ts";',
  "/page.js": dom,
});
const tail = (html: string) => JSON.parse(/<script type="rivet\/boundaries"[^>]*>(.*?)<\/script>/s.exec(html)![1]!);
const tag = (page: Page, selector: string): Promise<void> =>
  page.evaluate((s) => void ((document.querySelector(s) as unknown as Record<string, number>).__t = 1), selector);
const tagged = (page: Page, selector: string): Promise<boolean> =>
  page.evaluate((s) => (document.querySelector(s) as unknown as Record<string, number> | null)?.__t === 1, selector);
const loads = (page: Page): Promise<number> => page.evaluate(() => (globalThis as { loads?: number }).loads ?? 0);

compiled("server: an Async without a fallback — markers around its content, its value in the tail (also streamed)", async () => {
  const { Plain } = await build();
  const html = (await derivedToString(() => Plain({ data: Promise.resolve(ITEMS) }), { manifest })) as string;
  assert.match(html, /<!--a1--><ul id="list">.*<\/ul><!--\/a-->/s);
  assert.deepEqual(tail(html).a, [[1, 1, 0, 1, ITEMS]]);
  const chunks: string[] = [];
  await renderDerived(() => Plain({ data: Promise.resolve(ITEMS) }), { write: (chunk: string) => void chunks.push(chunk) }, { manifest, stream: {} });
  const streamed = chunks.join("");
  assert.match(streamed, /<!--a1--><ul id="list">.*<\/ul><!--\/a-->/s, "awaited in place: no fallback to stream first");
  assert.ok(!streamed.includes("<template"), "no segment");
  assert.deepEqual(tail(streamed).a, [[1, 1, 0, 1, ITEMS]]);
});

compiled("an Async without a fallback adopts with the server's value (its load never runs in the browser)", async () => {
  const { Plain, dom } = await build();
  const html = (await derivedToString(() => Plain({ data: Promise.resolve(ITEMS) }), { manifest })) as string;
  await withPage(files(html, dom), async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto("http://rivet.test/");
    await tag(page, "#list");
    await page.click("li:nth-child(2) button");
    await page.waitForFunction(() => document.querySelector("#picked")!.textContent === "Europa");
    assert.equal(await tagged(page, "#list"), true, "server nodes kept");
    assert.equal(await loads(page), 0);
    assert.deepEqual(errors, []);
  });
});

for (const fallback of [true, false])
  compiled("Async in For rows (" + (fallback ? "with" : "without") + " a fallback): a row's hole adopts by the marker it claims", async () => {
    const { Rows, dom } = await build();
    const load = (id: number) => Promise.resolve("t" + id);
    const html = (await derivedToString(() => Rows({ load, fallback }), { manifest })) as string;
    assert.deepEqual(
      tail(html).a.map((e: unknown[]) => e.slice(0, 3)),
      [
        [1, 1, 0],
        [2, 1, 1],
        [3, 1, 2],
      ],
      "numbered across the rows",
    );
    await withPage(files(html, dom), async (page) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto("http://rivet.test/");
      await tag(page, "#row-3 .pick");
      await page.click("#row-3 .pick");
      await page.waitForFunction(() => document.querySelector("#picked")!.textContent === "t3", null, { timeout: 3000 }).catch(() => {});
      assert.equal(await page.textContent("#picked"), "t3");
      await page.click("#row-2 .pick");
      await page.waitForFunction(() => document.querySelector("#picked")!.textContent === "t2", null, { timeout: 3000 }).catch(() => {});
      assert.equal(await page.textContent("#picked"), "t2");
      assert.equal(await tagged(page, "#row-3 .pick"), true, "server nodes kept");
      assert.equal(await loads(page), 0, "no load ran in the browser");
      assert.deepEqual(errors, []);
    });
  });
