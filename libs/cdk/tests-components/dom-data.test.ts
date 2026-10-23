// Built-collection rows over loader data (`/dom-data` story): a resumed handler sees the server data (deep equal). The
// former `D`-entry assertions went with the serialized model (M6-CUT 2026-10-22): on the derived model `resume.domData` is
// off by default and covers plain `For` lists over data props only, not built collections.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { stories, watch } from "./harness.ts";
type Stories = Awaited<ReturnType<typeof stories>>;

let s: Stories;
beforeAll(async () => {
  s = await stories();
});
afterAll(async () => s?.close());

const customers = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, name: `Customer ${i + 1} Holdings & Co`, mail: `customer.${i + 1}@example.com` }));
const contacts = customers.slice(0, 6).map((c) => ({ ...c, id: c.id + 100, name: `Contact of ${c.name}` }));

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
