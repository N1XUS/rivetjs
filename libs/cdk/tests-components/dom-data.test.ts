// DOM-backed loader data (DOM-DATA) over cdk built-collection rows: a `resume: { domData: true }` build of the story app
// (own dist, `RIVET_DOM_DATA=1`). A ListBox's rows iterate keys; `renderNodeAt` names each row's data object (`#server`
// `domRowItem`), so the item list travels as a `D` entry whose strings the browser reads back from the rows: a resumed
// handler sees the server data (deep equal).
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";

// Before the harness loads: `serve.ts` reads `STORIES_DIST` at import, the Vite config reads `RIVET_DOM_DATA` at build.
const env = { dist: process.env.STORIES_DIST, dd: process.env.RIVET_DOM_DATA };
process.env.STORIES_DIST = "dist-domdata";
process.env.RIVET_DOM_DATA = "1";
const { stories, watch } = await import("./harness.ts");
type Stories = Awaited<ReturnType<typeof stories>>;

let s: Stories;
beforeAll(async () => {
  try {
    s = await stories();
  } finally {
    for (const [key, value] of [
      ["STORIES_DIST", env.dist],
      ["RIVET_DOM_DATA", env.dd],
    ] as const)
      value === undefined ? delete process.env[key] : (process.env[key] = value);
  }
});
afterAll(async () => s?.close());

const customers = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, name: `Customer ${i + 1} Holdings & Co`, mail: `customer.${i + 1}@example.com` }));
const contacts = customers.slice(0, 6).map((c) => ({ ...c, id: c.id + 100, name: `Contact of ${c.name}` }));

test("dom-data: a ListBox's item list is a D entry; its names stay out of the state", async () => {
  const html = await (await fetch(s.origin + "/dom-data")).text();
  const state = /<script type="rivet\/state"[^>]*>(.*?)<\/script>/s.exec(html)![1]!;
  const parsed = JSON.parse(state) as { D?: number; t: unknown[] };
  assert.equal(parsed.D, 1);
  assert.ok(parsed.t.some((entry) => entry !== null && typeof entry === "object" && "D" in entry));
  // Escaped in the HTML (`&amp;`), whole in the state when it is a literal: neither form remains.
  for (const c of customers) assert.ok(!state.includes(JSON.stringify(c.name)), c.name);
  // The rows show them.
  for (const c of customers) assert.ok(html.includes(">" + c.name.replace("&", "&amp;") + "</div>"), c.name);
});

test("dom-data: a resumed handler reads the items back from the rows (deep equal to the server data)", async () => {
  const page = await s.browser.newPage();
  const seen = watch(page);
  const resumeErrors: string[] = [];
  await page.exposeFunction("__resumeError", (message: string) => resumeErrors.push(message));
  await page.addInitScript(() =>
    addEventListener("rivet:resume-error", (e) => (window as unknown as { __resumeError(m: string): void }).__resumeError(String((e as CustomEvent).detail))),
  );
  await page.goto(s.origin + "/dom-data");
  await page.click("#dd-all");
  await page.waitForFunction(() => document.querySelector("#dd-picked")!.textContent !== "-", undefined, { timeout: 5000 });
  assert.deepEqual(JSON.parse((await page.textContent("#dd-picked"))!), [customers, contacts]);
  assert.deepEqual(seen.errors, []);
  assert.deepEqual(resumeErrors, []);
  await page.close();
});
