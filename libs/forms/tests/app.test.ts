// Forms demo app end to end in Chromium (production build, node adapter): resumed signup form
// (no modules before interaction, blur issues, async check, enhanced submit → routed redirect),
// the same flow without JavaScript, the three-step wizard with and without JavaScript, and the `@rivetjs/ui` Form +
// named TextFields joined to the same store (`/ui-signup`, with and without JavaScript).
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { chromium, type Browser, type Page } from "playwright";
import { start } from "@rivetjs/router/node";
import { buildApp, dist } from "./app/serve.ts";

// `RIVET_RESUME_MODEL=derived` (M6-PARITY): the same flows over a derived-model build. Derived pages fetch the page's
// chunks ahead at low priority after `load` (`data-fo` modulepreloads: fetched, never evaluated before an event), so "no
// form code before interaction" is checked as "only modulepreloads, nothing ran" (the router brand is not installed yet).
const derived = process.env.RIVET_RESUME_MODEL === "derived";

const root = new URL("./app/", import.meta.url).pathname;
let origin = "";
let close: () => Promise<void> = async () => {};
let browser: Browser;

beforeAll(async () => {
  await buildApp();
  const app = await start({ dist, port: 0, host: "127.0.0.1", onError: () => {} });
  origin = app.url;
  close = () => app.close();
  browser = await chromium.launch({ headless: true });
});
afterAll(async () => {
  await browser?.close();
  await close();
});

function watch(page: Page) {
  const seen = { scripts: [] as string[], documents: 0, posts: 0, errors: [] as string[] };
  page.on("request", (request) => {
    if (request.resourceType() === "document") seen.documents++;
    if (request.resourceType() === "script" || /\.m?js$/.test(new URL(request.url()).pathname)) seen.scripts.push(request.url());
    if (request.method() === "POST") seen.posts++;
  });
  page.on("pageerror", (error) => seen.errors.push(error.message));
  return seen;
}

/** The form modules requested before any interaction: none — on derived, only the page's modulepreloads (nothing ran). */
async function untouched(page: Page, scripts: string[], pattern: RegExp): Promise<void> {
  const early = scripts.filter((url) => pattern.test(url));
  if (!derived) return assert.deepEqual(early, [], "no form modules before interaction");
  const { preloads, ran } = await page.evaluate(() => ({
    preloads: [...document.querySelectorAll<HTMLLinkElement>("link[rel=modulepreload]")].map((link) => link.href),
    // No router handler ran (they install the forms brand first) and no form field was touched.
    ran: !!(globalThis as Record<symbol, unknown>)[Symbol.for("rivet.router")] || !!document.querySelector("[aria-invalid]"),
  }));
  assert.deepEqual(
    early.filter((url) => !preloads.includes(url)),
    [],
    "only modulepreloads of form modules before interaction",
  );
  assert.equal(ran, false, "nothing ran before interaction");
}

/** Z1: a resumed router app boots nothing at idle; a press on a link starts the runtime + router (intent). Derived: the
 * press loads chunks only (the router adopts on the first event that needs it). */
async function intent(page: Page): Promise<void> {
  await page.dispatchEvent("a[href^='/']", "pointerdown");
  if (!derived) await page.waitForFunction(() => (document as unknown as { $r?: { r(): unknown } }).$r?.r());
  await page.waitForLoadState("networkidle");
}

test("signup (JS): no form modules before interaction, issues on blur, async check, enhanced submit routes to /welcome", async () => {
  const page = await browser.newPage();
  const seen = watch(page);
  await page.goto(origin + "/signup");
  await page.waitForTimeout(200);
  // Only the router's idle boot (client navigation); no form code before interaction.
  await untouched(page, seen.scripts, /definitions|Signup|enhance|transport|signup/);
  const before = seen.scripts.length;
  // Blur an invalid email: the handler chunk loads, the issue shows, the input is marked invalid.
  await page.fill("#signup-email", "nope");
  await page.locator("#signup-email").blur();
  await page.waitForFunction(() => document.querySelector("#signup-email-error")?.textContent?.includes("Enter an email address"));
  assert.equal(await page.getAttribute("#signup-email", "aria-invalid"), "true");
  assert.equal(await page.getAttribute("#signup-email", "aria-describedby"), "signup-email-error");
  // (Derived: the chunks were fetched ahead; the issue above shows the blur adopted the form.)
  if (!derived) assert.ok(seen.scripts.length > before);
  // Fixing it clears the issue as you type (revalidate on input); the async check then runs.
  await page.fill("#signup-email", "taken@example.com");
  await page.waitForFunction(() => document.querySelector("#signup-email-error")?.textContent?.includes("already registered"));
  // Submitting with problems focuses the first invalid field and fills the summary.
  await page.fill("#signup-email", "new@example.com");
  await page.click("button[type=submit]");
  await page.waitForFunction(() => document.activeElement?.id === "signup-name");
  assert.match((await page.textContent("#signup-summary")) ?? "", /This field is required/);
  assert.equal(seen.posts, 0, "invalid forms never post");
  await page.fill("#signup-name", "Ada");
  await page.fill("#signup-password", "correct horse");
  await page.fill("#signup-confirm", "correct horse");
  await page.fill("#signup-age", "36");
  await page.click("button[type=submit]");
  await page.waitForURL(origin + "/welcome");
  await page.waitForSelector("#welcome-title");
  assert.equal(seen.posts, 1);
  assert.equal(seen.documents, 1, "enhanced submit and redirect stay in the page");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("same-URL enhanced submit revalidates the page from the action's answer (one POST, no data request)", async () => {
  const page = await browser.newPage();
  const seen = watch(page);
  const data: string[] = [];
  page.on("request", (request) => new URL(request.url()).searchParams.get("_rivet") === "data" && data.push(request.url()));
  await page.goto(origin + "/notes");
  await intent(page);
  for (const note of ["first", "second"]) {
    await page.fill("#note-text", note);
    await page.click("#note-add");
    await page.waitForFunction((note) => [...document.querySelectorAll("#notes li")].some((li) => li.textContent === note), note);
  }
  assert.deepEqual(await page.locator("#notes li").allTextContents(), ["first", "second"]);
  assert.equal(new URL(page.url()).pathname, "/notes");
  assert.equal(await page.inputValue("#note-text"), "", "reset after success");
  assert.equal(seen.posts, 2);
  assert.equal(seen.documents, 1, "no page load");
  assert.deepEqual(data, [], "single flight: the action's answer carried the data");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("autosave leave guard: client navigation confirms while unsaved; closing gets the beforeunload prompt", async () => {
  const page = await browser.newPage();
  const seen = watch(page);
  const dialogs: string[] = [];
  let answer = false;
  page.on("dialog", (dialog) => {
    dialogs.push(dialog.type() + ":" + (dialog.type() === "confirm" ? dialog.message() : ""));
    void (answer ? dialog.accept() : dialog.dismiss());
  });
  await page.goto(origin + "/draft");
  await intent(page);
  // Nothing typed: leaving needs no confirmation.
  await page.click("#draft-leave");
  await page.waitForSelector("h1:text('Rivet forms demo')");
  assert.deepEqual(dialogs, []);
  await page.goBack();
  await page.waitForSelector("#draft-body");
  await page.waitForLoadState("networkidle");
  await page.fill("#draft-body", "half a thought");
  await page.waitForFunction(() => document.querySelector("#draft-status")?.textContent === "Unsaved changes");
  // Dismissed: the page stays.
  await page.click("#draft-leave");
  await page.waitForFunction(() => document.title === "Draft");
  assert.deepEqual(dialogs, ["confirm:Leave with unsaved changes?"]);
  assert.equal(new URL(page.url()).pathname, "/draft");
  assert.equal(await page.inputValue("#draft-body"), "half a thought");
  // Back/forward (the router's `history` leave) confirms too; dismissed: history walks back, the page stays.
  await page.evaluate(() => history.forward());
  await page.waitForFunction(() => location.pathname === "/draft" && document.title === "Draft");
  await page.waitForTimeout(100);
  assert.deepEqual(dialogs, ["confirm:Leave with unsaved changes?", "confirm:Leave with unsaved changes?"]);
  assert.equal(new URL(page.url()).pathname, "/draft");
  assert.equal(await page.inputValue("#draft-body"), "half a thought");
  // Closing or reloading: the beforeunload event is cancelled, so the browser asks with its own prompt
  // (headless Chromium shows none, so the event is dispatched here).
  const unload = () => page.evaluate(() => !dispatchEvent(new Event("beforeunload", { cancelable: true })));
  assert.equal(await unload(), true);
  // Accepted: the client navigation goes ahead; the guard leaves with the page.
  answer = true;
  await page.click("#draft-leave");
  await page.waitForSelector("h1:text('Rivet forms demo')");
  assert.equal(dialogs.length, 3);
  assert.equal(await unload(), false, "no guard once the page is gone");
  assert.equal(seen.documents, 1, "client navigation only");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("signup (no JS): 400 page with issues, echoed values (never the password), autofocus; then success", async () => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(origin + "/signup");
  await page.fill("#signup-name", "Ada");
  await page.fill("#signup-email", "taken@example.com");
  await page.fill("#signup-password", "short");
  await page.fill("#signup-confirm", "short");
  const response = await Promise.all([page.waitForNavigation(), page.click("button[type=submit]")]).then(([r]) => r);
  assert.equal(response?.status(), 400);
  assert.equal(await page.inputValue("#signup-name"), "Ada");
  assert.equal(await page.inputValue("#signup-email"), "taken@example.com");
  assert.equal(await page.inputValue("#signup-password"), "");
  assert.match((await page.textContent("#signup-email-error")) ?? "", /already registered/);
  assert.match((await page.textContent("#signup-password-error")) ?? "", /at least 8/);
  assert.equal(await page.getAttribute("#signup-email", "autofocus"), "");
  assert.equal(await page.getAttribute("#signup-name", "autofocus"), null);
  assert.equal(await page.getAttribute("#signup-email", "aria-invalid"), "true");
  await page.fill("#signup-email", "ada@example.com");
  await page.fill("#signup-password", "correct horse");
  await page.fill("#signup-confirm", "correct horse");
  await Promise.all([page.waitForURL(origin + "/welcome"), page.click("button[type=submit]")]);
  assert.match((await page.textContent("h1")) ?? "", /Welcome aboard/);
  await context.close();
});

async function runWizard(page: Page) {
  await page.goto(origin + "/wizard");
  await page.fill("#account-name", "Ada");
  await page.fill("#account-email", "ada@example.com");
  await Promise.all([page.waitForURL(/step=address/), page.click("button[type=submit]")]);
  await page.waitForSelector("#address-city");
  assert.match((await page.textContent("#wizard-step")) ?? "", /Step 2 of 3/);
  // Back keeps the saved step output.
  await Promise.all([page.waitForURL(/step=account/), page.click("#wizard-back")]);
  await page.waitForSelector("#account-name");
  assert.equal(await page.inputValue("#account-name"), "Ada");
  await Promise.all([page.waitForURL(/step=address/), page.click("button[type=submit]")]);
  await page.waitForSelector("#address-city");
  await page.fill("#address-city", "Kyiv");
  await page.fill("#address-zip", "01001");
  await Promise.all([page.waitForURL(/step=confirm/), page.click("button[type=submit]")]);
  await page.waitForSelector("#confirm-agree");
  await page.check("#confirm-agree");
  await Promise.all([page.waitForURL(origin + "/welcome"), page.click("button[type=submit]")]);
  await page.waitForSelector("#welcome-title");
}

test("wizard (JS): enhanced steps, back keeps values, completion", async () => {
  const page = await browser.newPage();
  const seen = watch(page);
  await runWizard(page);
  assert.equal(seen.documents, 1);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("wizard (no JS): same flow with full page round trips; skipping ahead is clamped", async () => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await runWizard(page);
  await page.goto(origin + "/wizard?step=confirm");
  assert.match((await page.textContent("#wizard-step")) ?? "", /Step 1 of 3/);
  await context.close();
});

test("field array: add/remove rows in the browser and without JS, values and issues follow their rows", async () => {
  const page = await browser.newPage();
  const seen = watch(page);
  await page.goto(origin + "/order");
  await page.fill("[name='items.0.sku']", "A-1");
  await page.click("#order-add");
  await page.waitForSelector("[name='items.1.sku']");
  await page.waitForFunction(() => document.activeElement?.getAttribute("name") === "items.1.sku");
  await page.fill("[name='items.1.sku']", "B-2");
  await page.click("#order-add");
  await page.waitForSelector("[name='items.2.sku']");
  await page.click("#order-submit");
  // The empty third row is invalid; its issue shows on that row.
  await page.waitForFunction(() => document.querySelectorAll("#order-rows li")[2]?.textContent?.includes("Enter a product code"));
  await page.click("text=Remove 1");
  await page.waitForFunction(() => document.querySelectorAll("#order-rows li").length === 2);
  assert.equal(await page.inputValue("[name='items.0.sku']"), "B-2");
  // The issue moved with its row (now index 1).
  assert.match((await page.locator("#order-rows li").nth(1).textContent()) ?? "", /Enter a product code/);
  await page.click("text=Remove 2");
  await page.waitForFunction(() => document.querySelectorAll("#order-rows li").length === 1);
  assert.equal(seen.posts, 0, "intents never post with JS");
  await page.click("#order-submit");
  await page.waitForURL(origin + "/welcome");
  assert.equal(seen.posts, 1);
  assert.deepEqual(seen.errors, []);
  await page.close();

  const context = await browser.newContext({ javaScriptEnabled: false });
  const nojs = await context.newPage();
  await nojs.goto(origin + "/order");
  await nojs.fill("[name='items.0.sku']", "A-1");
  await Promise.all([nojs.waitForNavigation(), nojs.click("#order-add")]);
  assert.equal(await nojs.locator("#order-rows li").count(), 2);
  assert.equal(await nojs.inputValue("[name='items.0.sku']"), "A-1");
  await nojs.fill("[name='items.1.sku']", "B-2");
  await Promise.all([nojs.waitForNavigation(), nojs.click("text=Remove 1")]);
  assert.equal(await nojs.locator("#order-rows li").count(), 1);
  assert.equal(await nojs.inputValue("[name='items.0.sku']"), "B-2");
  await Promise.all([nojs.waitForURL(origin + "/welcome"), nojs.click("#order-submit")]);
  await context.close();
});

test("contact (custom submit, SSR): native form posting to the third-party endpoint", async () => {
  const html = await (await fetch(origin + "/contact")).text();
  assert.match(html, /<form[^>]*method="post"[^>]*action="https:\/\/forms\.example\.test\/contact"/);
  assert.match(html, /enctype="multipart\/form-data"/);
  // (Serialized: the button's resume record `data-r` + its text site marker; derived: plain markup.)
  assert.match(
    html,
    derived
      ? /<button id="contact-send" type="submit" class="button">Send/
      : /<button id="contact-send" type="submit" class="button" data-r="\d+">(<!--r\d*-->)?Send/,
    "enabled, not submitting",
  );
});

test("contact (JS, resumed): defineForm submit posts to the external endpoint; submitting, issues, focus, success, errors", async () => {
  const page = await browser.newPage();
  const seen = watch(page);
  const external: { method: string; accept?: string; body: string }[] = [];
  let reply: { status: number; body: unknown; delay?: number } = { status: 200, body: {} };
  await page.route("https://forms.example.test/**", async (route) => {
    const request = route.request();
    external.push({ method: request.method(), accept: request.headers().accept, body: request.postData() ?? "" });
    const { status, body, delay } = reply;
    if (delay) await new Promise((done) => setTimeout(done, delay));
    await route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) });
  });
  await page.goto(origin + "/contact");
  await page.waitForTimeout(200);
  await untouched(page, seen.scripts, /definitions|contact|enhance|submit/i);
  // Invalid: nothing sent, first invalid field focused.
  await page.click("#contact-send");
  await page.waitForFunction(() => document.activeElement?.id === "contact-email");
  assert.equal(external.length, 0, "invalid forms never post");
  // Endpoint rejects: its field + form issues show, the field is focused again.
  await page.fill("#contact-email", "ada@example.com");
  await page.fill("#contact-message", "Hello");
  reply = { status: 422, body: { errors: { email: "That address bounced" }, message: "Check the form" } };
  await page.click("#contact-send");
  await page.waitForFunction(() => document.querySelector("#contact-email-error")?.textContent === "That address bounced");
  assert.match((await page.textContent("#contact-summary")) ?? "", /Check the form/);
  assert.equal(await page.getAttribute("#contact-email", "aria-invalid"), "true");
  await page.waitForFunction(() => document.activeElement?.id === "contact-email");
  assert.equal(external.length, 1);
  assert.equal(external[0]!.method, "POST");
  assert.equal(external[0]!.accept, "application/json");
  assert.match(external[0]!.body, /name="email"\r\n\r\nada@example.com/);
  // Success (slow): submitting() while in flight, then lastResult + reset.
  reply = { status: 200, body: {}, delay: 300 };
  await page.click("#contact-send");
  await page.waitForFunction(() => document.querySelector("#contact-send")?.textContent === "Sending…");
  assert.equal(await page.getAttribute("#contact-send", "disabled"), "");
  assert.equal(await page.getAttribute("#contact", "aria-busy"), "true");
  await page.waitForFunction(() => document.querySelector("#contact-sent")?.textContent === "Thanks, we will reply to ada@example.com");
  assert.equal(await page.textContent("#contact-send"), "Send");
  assert.equal(await page.inputValue("#contact-email"), "", "reset after success");
  assert.equal(await page.getAttribute("#contact-email", "aria-invalid"), null);
  // Server error: thrown in submit → form-level issue (FormStatus).
  await page.fill("#contact-email", "ada@example.com");
  await page.fill("#contact-message", "Again");
  reply = { status: 500, body: { message: "Service down" } };
  await page.click("#contact-send");
  await page.waitForFunction(() => document.querySelector("#contact [role=status]")?.textContent === "Service down");
  assert.equal(external.length, 3);
  assert.equal(seen.posts, 3, "only the external endpoint was posted to");
  assert.equal(seen.documents, 1);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("contact (JS, resumed): the first submit of an empty form with native `required` reports library messages (G14)", async () => {
  const page = await browser.newPage();
  const seen = watch(page);
  const external: string[] = [];
  await page.route("https://forms.example.test/**", (route) => (external.push(route.request().url()), route.abort()));
  await page.goto(origin + "/contact");
  // No handler ran yet: native validation is still on (no-JS posts keep `required`), so this submit
  // is stopped by it before `submit` fires; `onInvalid` takes over from the first attempt.
  assert.equal(await page.evaluate(() => document.querySelector<HTMLFormElement>("#contact")!.noValidate), false);
  await page.click("#contact-send");
  await page.waitForFunction(() => document.querySelector("#contact-email-error")?.textContent === "This field is required", undefined, { timeout: 5000 });
  assert.equal(await page.textContent("#contact-message-error"), "This field is required");
  assert.equal(await page.getAttribute("#contact-email", "aria-invalid"), "true");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "contact-email");
  assert.equal(await page.evaluate(() => document.querySelector<HTMLFormElement>("#contact")!.noValidate), true);
  // Fixed, the next submit goes through `onSubmit` (library validation only).
  await page.fill("#contact-email", "ada@example.com");
  await page.fill("#contact-message", "Hello");
  await page.click("#contact-send");
  await page.waitForFunction(() => document.querySelector("#contact [role=status]")?.textContent, undefined, { timeout: 5000 });
  assert.equal(external.length, 1);
  assert.equal(seen.documents, 1);
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("contact (no JS): native multipart POST to the external endpoint", async () => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const posted: string[] = [];
  await page.route("https://forms.example.test/**", async (route) => {
    posted.push(route.request().method() + " " + (route.request().headers()["content-type"] ?? "") + " " + (route.request().postData() ?? ""));
    await route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Thanks (external)</h1>" });
  });
  await page.goto(origin + "/contact");
  await page.fill("#contact-email", "ada@example.com");
  await page.fill("#contact-message", "No script");
  await Promise.all([page.waitForURL("https://forms.example.test/contact"), page.click("#contact-send")]);
  assert.equal(await page.textContent("h1"), "Thanks (external)");
  assert.equal(posted.length, 1);
  assert.match(posted[0]!, /^POST multipart\/form-data/);
  assert.match(posted[0]!, /No script/);
  await context.close();
});

const errorOf = (name: string) => `[data-slot="textfield"]:has(input[name=${name}]) [data-slot="field-error"]`;

test("ui Form + named TextFields (JS, resumed): blur issues, async check, submit focuses the first invalid field, success", async () => {
  const page = await browser.newPage();
  const seen = watch(page);
  await page.goto(origin + "/ui-signup");
  await page.waitForTimeout(200);
  const email = page.locator("input[name=email]");
  await email.fill("nope");
  await email.blur();
  await page.waitForFunction((sel) => document.querySelector(sel)?.textContent?.includes("Enter an email address"), errorOf("email"));
  assert.equal(await email.getAttribute("aria-invalid"), "true");
  const errorId = await page.getAttribute(errorOf("email"), "id");
  assert.ok((await email.getAttribute("aria-describedby"))?.split(" ").includes(errorId!));
  await email.fill("taken@example.com");
  await page.waitForFunction((sel) => document.querySelector(sel)?.textContent?.includes("already registered"), errorOf("email"));
  await email.fill("new@example.com");
  await page.click("button[type=submit]");
  await page.waitForFunction(() => (document.activeElement as HTMLInputElement | null)?.name === "name");
  assert.equal(await page.getAttribute("input[name=name]", "aria-invalid"), "true");
  assert.equal(seen.posts, 0, "invalid forms never post");
  await page.fill("input[name=name]", "Ada");
  await page.fill("input[name=password]", "correct horse");
  await page.fill("input[name=confirm]", "correct horse");
  await page.click("button[type=submit]");
  await page.waitForURL(origin + "/welcome");
  assert.equal(seen.posts, 1);
  assert.equal(seen.documents, 1, "enhanced submit and redirect stay in the page");
  assert.deepEqual(seen.errors, []);
  await page.close();
});

test("ui Form + named TextFields (no JS): 400 page with issues and echoed values (never the password)", async () => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(origin + "/ui-signup");
  await page.fill("input[name=name]", "Ada");
  await page.fill("input[name=email]", "taken@example.com");
  await page.fill("input[name=password]", "short");
  await page.fill("input[name=confirm]", "short");
  const response = await Promise.all([page.waitForNavigation(), page.click("button[type=submit]")]).then(([r]) => r);
  assert.equal(response?.status(), 400);
  assert.equal(await page.inputValue("input[name=name]"), "Ada");
  assert.equal(await page.inputValue("input[name=email]"), "taken@example.com");
  assert.equal(await page.inputValue("input[name=password]"), "");
  assert.match((await page.textContent(errorOf("email"))) ?? "", /already registered/);
  assert.match((await page.textContent(errorOf("password"))) ?? "", /at least 8/);
  assert.equal(await page.getAttribute("input[name=email]", "aria-invalid"), "true");
  await context.close();
});
