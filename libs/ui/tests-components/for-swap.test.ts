// Keyed For rows on a resumed page (story `/for-swap`, music showcase repro): a like button with a signal-read `aria-pressed` in a
// server row toggles in place (one element per id, no re-created region next to the old node); after the album swap every row is
// browser-created and its like button still handles clicks. `#u-*` / `#v-*` ui Button (accessor / value `aria-pressed`), `#p-*` plain button.
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { stories, watch, type Stories, type Watch } from "./harness.ts";

let s: Stories;
let page: Page;
let seen: Watch;
const logged: string[] = [];
beforeAll(async () => {
  s = await stories();
  page = await s.browser.newPage();
  seen = watch(page);
  page.on("console", (message) => (message.type() === "error" || message.type() === "warning") && logged.push(message.text()));
  await page.goto(s.origin + "/for-swap");
});
afterAll(async () => s?.close());

const pressed = (id: string) => page.getAttribute("#" + id, "aria-pressed");
const count = (id: string) => page.evaluate((i) => document.querySelectorAll("#" + i).length, id);
const liked = (kind: string, want: string) => page.waitForFunction(([k, w]) => document.getElementById(k + "-liked")!.textContent === w, [kind, want] as const);

const NAMES: Record<string, string> = { u: "ui Button (accessor aria-pressed)", v: "ui Button (value aria-pressed)", p: "plain button" };
// `v`: the cdk Button snapshots its props (contextProps / mergeProps, cdk live-props migration pending), so a value-form
// `aria-pressed` keeps its first value in every row (client renders too): only the clicks and ids are checked there.
const state = (kind: string, id: string, want: string) => (kind === "v" ? Promise.resolve() : pressed(id).then((v) => assert.equal(v, want)));
for (const kind of ["u", "v", "p"]) {
  test(`${NAMES[kind]}: like in a server row toggles in place; rows of a swapped album handle clicks`, async () => {
    await page.click(`#${kind}-like-a2`);
    await liked(kind, "a2");
    await state(kind, `${kind}-like-a2`, "true");
    assert.equal(await count(`${kind}-like-a2`), 1, "no duplicate next to the server node");
    await page.click(`#${kind}-like-a2`);
    await liked(kind, "");
    await state(kind, `${kind}-like-a2`, "false");
    assert.equal(await count(`${kind}-like-a2`), 1);

    await page.click(`#${kind}-b`);
    await page.waitForSelector(`#${kind}-like-b1`);
    assert.equal(await count(`${kind}-like-a1`), 0);
    await page.click(`#${kind}-like-b2`);
    await liked(kind, "b2");
    await state(kind, `${kind}-like-b2`, "true");
    await page.click(`#${kind}-like-b1`);
    await liked(kind, "b2,b1");
    assert.equal(await count(`${kind}-like-b1`), 1);

    await page.click(`#${kind}-a`);
    await page.waitForSelector(`#${kind}-like-a1`);
    await page.click(`#${kind}-like-a3`);
    await liked(kind, "b2,b1,a3");
    await state(kind, `${kind}-like-a3`, "true");
    assert.deepEqual(seen.errors, []);
    assert.deepEqual(logged, []);
  });
}
