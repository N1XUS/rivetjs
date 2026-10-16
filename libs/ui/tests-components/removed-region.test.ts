// Removed server regions bound to a shared signal (story `/removed-region`, showcase-auth repro): a TextField bound to `email` in a step
// the browser removes (JSX ternary, `<Show keyed>`), replaced by a client TextField bound to the same signal — the next writes update the
// replacement and log no "Missing resumable element". A Label in a `<div>` next to a conditional sibling inside a TextField resumes too.
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
  await page.goto(s.origin + "/removed-region");
});
afterAll(async () => s?.close());

const value = (selector: string) => page.inputValue(selector);
const until = (selector: string, want: string) =>
  page.waitForFunction(([sel, w]) => (document.querySelector(sel!) as HTMLInputElement | null)?.value === w, [selector, want] as const);

for (const kind of ["t", "k"]) {
  test(`${kind === "t" ? "ternary" : "keyed Show"}: writes after the server step was removed update the client step only`, async () => {
    await page.click(`#${kind}-go`);
    await page.waitForSelector(`#${kind}-code-input`);
    assert.equal(await page.$(`#${kind}-input`), null);
    await page.click(`#${kind}-type`);
    await until(`#${kind}-code-input`, "x");
    await page.click(`#${kind}-type`);
    await until(`#${kind}-code-input`, "xx");
    await page.fill(`#${kind}-code-input`, "typed");
    await page.click(`#${kind}-go`);
    await page.waitForSelector(`#${kind}-input`);
    await page.click(`#${kind}-type`);
    await until(`#${kind}-input`, "typedx");
    assert.equal(await value(`#${kind}-input`), "typedx");
    assert.deepEqual(seen.errors, []);
    assert.deepEqual(logged, []);
  });
}

test("Label in a div next to a conditional sibling: first changes resume", async () => {
  await page.click("#w-hint-toggle");
  await page.waitForSelector("#w-hint");
  await page.click("#w-type");
  await until("#w-input", "x");
  await page.click("#w-hint-toggle");
  await page.waitForFunction(() => !document.getElementById("w-hint"));
  await page.click("#w-type");
  await until("#w-input", "xx");
  assert.deepEqual(seen.errors, []);
  assert.deepEqual(logged, []);
});

test("showcase-auth: computed password visibility follows repeated toggles in both forms after resume and remount", async () => {
  const auth = await s.browser.newPage();
  const errors: string[] = [];
  auth.on("pageerror", (error) => errors.push(error.message));
  auth.on("console", (message) => (message.type() === "error" || message.type() === "warning") && errors.push(message.text()));
  try {
    await auth.goto(s.origin + "/removed-region-auth");
    for (const remounted of [false, true]) {
      if (remounted) {
        await auth.click("text=Continue with a passkey");
        await auth.waitForSelector("text=Check your inbox");
        await auth.click("text=Use another account");
        await auth.waitForSelector("#signin-password", { state: "attached" });
      }
      for (const mode of ["signin", "signup"]) {
        await auth.getByRole("radio", { name: mode === "signin" ? "Sign in" : "Create account", exact: true }).click();
        const form = auth.locator(`#${mode}-form`);
        await form.waitFor({ state: "visible" });
        await auth.fill(`#${mode}-password`, "Secret123!");
        for (const type of ["text", "password", "text", "password"]) {
          await form.getByRole("button", { name: type === "text" ? "Show password" : "Hide password" }).click();
          await auth.waitForFunction(
            (want) => ["signin", "signup"].every((mode) => (document.getElementById(`${mode}-password`) as HTMLInputElement)?.type === want),
            type,
            { timeout: 5000 },
          );
          assert.equal(await auth.inputValue(`#${mode}-password`), "Secret123!");
        }
      }
    }
    assert.deepEqual(errors, []);
  } finally {
    await auth.close();
  }
});

for (const typeFirst of [false, true])
  test(`showcase-auth without its workaround (${typeFirst ? "typed" : "untouched"} first): the removed server form step leaves no resumed binding behind`, async () => {
    const auth = await s.browser.newPage();
    const errors: string[] = [];
    auth.on("pageerror", (error) => errors.push(error.message));
    auth.on("console", (message) => (message.type() === "error" || message.type() === "warning") && errors.push(message.text()));
    await auth.goto(s.origin + "/removed-region-auth");
    if (typeFirst) await auth.fill("#signin-email", "a@x.test");
    await auth.click("text=Continue with a passkey");
    await auth.waitForSelector("text=Check your inbox");
    assert.equal(await auth.$("#signin-email"), null);
    await auth.click("text=Use another account");
    await auth.waitForSelector("#signin-email");
    await auth.fill("#signin-email", "b@x.test");
    await auth.click("text=Email me a sign-in link");
    await auth.waitForSelector("#reset-email");
    await auth.fill("#reset-email", "c@x.test");
    await auth.click("#reset-submit");
    await auth.waitForSelector("#reset-status");
    assert.match((await auth.textContent("#reset-status"))!, /c@x\.test/);
    assert.deepEqual(errors, []);
    await auth.close();
  });
