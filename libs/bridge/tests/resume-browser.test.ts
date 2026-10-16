// T4 end to end in Chromium: a server-rendered page with a `client="load"` island resumes; the root's hydration effect
// (root.tsx, resume symbol) imports the real driver (`@rivetjs/bridge/client`), which hydrates through the island chunk
// (fake client adapter); a Rivet button changes a live prop (one update, in place); the framework's callback writes a
// Rivet signal (resumed Rivet binding updated). Runtime harness: libs/runtime/tests/resume/harness.ts.
import { test } from "vitest";
import assert from "node:assert/strict";
import { withPage } from "../../runtime/tests/resume/harness.ts";
import { resumedPage } from "./resume-page.ts";

const source = `
import { signal } from "@rivetjs/reactivity";
import { _island } from "@rivetjs/bridge/server";
import { fake, Clicker } from "./fake-adapter.ts";
const COUNTER = { id: "src/Counter.fake#default", c: Clicker, a: fake, chunk: "/islands/counter.js" };
function loadCounter() { return import("/islands/counter.js"); }
export function Counter(props) { return <>{_island(props, COUNTER, loadCounter)}</>; }
export function Page() {
  const n = signal(1), total = signal(0);
  return <main>
    <Counter client="load" count={n()} onIncrement={(k) => total.set(total() + k)} />
    <button class="next" onClick={() => n.set(n() + 1)}>next</button>
    <p class="total">{total()}</p>
  </main>;
}
`;

const files = await resumedPage(source);

test("resumed page: the island hydrates through the real driver, live prop updates in place, callback writes a Rivet signal", async () => {
  await withPage(files, async (browser, requests) => {
    const errors: string[] = [];
    browser.on("pageerror", (error) => errors.push(String(error)));
    browser.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    await browser.goto("http://rivet.test/");
    await browser.waitForFunction(() => (window as unknown as { __log?: unknown[] }).__log?.length);
    const calls = () =>
      browser.evaluate(() =>
        (window as unknown as { __log: { call: string; id?: string; props?: { count?: unknown } }[] }).__log.map((e) => [
          e.call,
          e.id ?? null,
          e.props?.count ?? null,
        ]),
      );
    assert.deepEqual(await calls(), [["hydrate", "i0", 1]]);
    assert.ok(requests.includes("/islands/counter.js") && requests.includes("/bridge/client.js"));
    // The island's server nodes stay (hydrated, not re-rendered).
    await browser.evaluate(() => ((document.querySelector("rivet-island span") as unknown as { __kept: boolean }).__kept = true));
    await browser.click(".next");
    await browser.waitForFunction(() => document.querySelector("rivet-island span")?.textContent === "2");
    assert.deepEqual((await calls()).at(-1), ["update", null, 2]);
    assert.equal(await browser.evaluate(() => (document.querySelector("rivet-island span") as unknown as { __kept?: boolean }).__kept), true);
    // Framework click → wrapped callback → Rivet signal → resumed binding.
    await browser.click("rivet-island button");
    await browser.waitForFunction(() => document.querySelector(".total")?.textContent === "1");
    assert.deepEqual(errors, []);
  });
});
