// Browser journeys use a built production app and a fresh browser context for every case.
import assert from "node:assert/strict";
import { join } from "node:path";
import { afterAll, beforeAll, test } from "vitest";
import { chromium, type Browser, type BrowserContext, type BrowserContextOptions, type Page } from "playwright";
import type { Cart, Draft } from "../src/server/service.server.ts";
import { startApp, type AppFixture } from "./_support.ts";

let app: AppFixture;
let browser: Browser | undefined;
let base: string;

beforeAll(async () => {
  app = await startApp("journeys");
  base = app.base;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    await app.close();
    throw error;
  }
});

afterAll(async () => {
  try {
    await browser?.close();
  } finally {
    await app?.close();
  }
});

async function login(context: BrowserContext, email = "alice@alpha.test") {
  const response = await context.request.post(base + "/auth/session", {
    headers: { origin: base },
    data: { email, password: "demo-pass-2026" },
  });
  assert.equal(response.status(), 200);
}

async function api<T = unknown>(context: BrowserContext, path: string, method = "GET", data?: unknown): Promise<{ status: number; data: T }> {
  const response = await context.request.fetch(base + path, {
    method,
    headers: { origin: base },
    ...(data === undefined ? {} : { data }),
  });
  return { status: response.status(), data: (await response.json()) as T };
}

async function clearCart(context: BrowserContext) {
  let cart = (await api<Cart>(context, "/store/api/cart")).data;
  for (const item of cart.items) {
    const response = await api<Cart>(context, "/store/api/cart", "PUT", { version: cart.version, sku: item.product.sku, quantity: 0 });
    assert.equal(response.status, 200);
    cart = response.data;
  }
}

async function add(context: BrowserContext, sku = "sku-1", quantity = 1) {
  const cart = (await api<Cart>(context, "/store/api/cart")).data;
  const response = await api<Cart>(context, "/store/api/cart", "PUT", { version: cart.version, sku, quantity });
  assert.equal(response.status, 200);
  return response.data;
}

interface Journey {
  name: string;
  run(page: Page, context: BrowserContext): Promise<void>;
  options: BrowserContextOptions;
}

const journeys: Journey[] = [];
function journey(name: string, run: Journey["run"], options: BrowserContextOptions = {}) {
  journeys.push({ name, run, options });
}

journey("storefront-server-html-and-24-products", async (p) => {
  const r = await p.goto(base + "/store");
  assert.equal(r?.status(), 200);
  assert.equal(await p.locator("[data-product]").count(), 24);
  await p.screenshot({ path: join(app.artifacts, "storefront.png"), fullPage: false });
});
journey("catalog-query-sort-reload-back-forward", async (p) => {
  await p.goto(base + "/store");
  await p.locator("#shop-search").fill("notebook");
  await p.locator("#shop-sort").selectOption("price");
  await p.locator("#shop-filter").click();
  await p.waitForURL(/q=notebook/);
  assert.equal(await p.locator("[data-product]").count(), 3);
  await p.reload();
  assert.equal(await p.locator("#shop-search").inputValue(), "notebook");
  await p.goto(base + "/store?category=Wear");
  assert.equal(await p.locator("[data-product]").count(), 8);
  await p.goBack();
  assert.equal(await p.locator("#shop-search").inputValue(), "notebook");
  await p.goForward();
  assert.equal(await p.locator("#shop-category").inputValue(), "Wear");
});
journey(
  "catalog-native-filter-without-javascript",
  async (p) => {
    await p.goto(base + "/store");
    await p.locator("#shop-search").fill("lamp");
    await p.locator("#shop-filter").click();
    await p.waitForURL(/q=lamp/);
    assert.equal(await p.locator("[data-product]").count(), 3);
  },
  { javaScriptEnabled: false },
);
journey("product-deep-link-and-real-404", async (p) => {
  await p.goto(base + "/store/products/sku-1");
  assert.match(await p.locator("h1").innerText(), /Canvas/);
  assert.match(await p.locator("#stock").innerText(), /in stock/);
  assert.equal((await p.goto(base + "/store/products/missing"))?.status(), 404);
});
journey(
  "mobile-storefront-does-not-overflow",
  async (p) => {
    await p.goto(base + "/store");
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  },
  { viewport: { width: 375, height: 812 } },
);
journey(
  "native-sign-in-without-javascript",
  async (p) => {
    await p.goto(base + "/sign-in");
    await p.locator("#login-email").fill("editor@alpha.test");
    await p.locator("#login-password").fill("demo-pass-2026");
    await p.locator("#login-submit").click();
    await p.waitForURL(base + "/desk");
    assert.match(await p.locator("#desk-identity").innerText(), /Jules Editor/);
  },
  { javaScriptEnabled: false },
);
journey("wrong-password-shows-error-and-no-session", async (p, c) => {
  await p.goto(base + "/sign-in");
  await p.locator("#login-email").fill("alice@alpha.test");
  await p.locator("#login-password").fill("wrong-secret");
  await p.locator("#login-submit").click();
  await p.locator('[role="alert"]').waitFor();
  assert.ok(!(await c.cookies()).some((x) => x.name === "case-session"));
  assert.ok(!(await p.content()).includes("wrong-secret"));
});
journey("httpOnly-session-is-not-readable-by-javascript", async (p, c) => {
  await login(c);
  await p.goto(base + "/desk");
  assert.ok(!(await p.evaluate(() => document.cookie)).includes("case-session"));
});
journey("cart-add-quantity-promotion-and-reload", async (p, c) => {
  await login(c);
  await clearCart(c);
  await p.goto(base + "/store");
  const added = p.waitForResponse((r) => r.url().endsWith("/store/api/cart") && r.request().method() === "PUT");
  await p.locator('[data-product="sku-1"] .add-to-cart').click();
  assert.equal((await added).status(), 200);
  await p.goto(base + "/store/cart");
  await p.locator('[data-cart-sku="sku-1"] .increase').click();
  await p.waitForFunction(() => document.querySelector(".quantity")?.textContent === "2");
  await p.locator("#coupon").fill("DEMO10");
  const promoted = p.waitForResponse((r) => r.url().endsWith("/store/api/cart") && r.request().method() === "PUT");
  await p.locator("#apply-coupon").click();
  await promoted;
  await p.waitForFunction(() => document.querySelector("#discount")?.textContent !== "$0.00");
  const total = await p.locator("#cart-total").innerText();
  await p.reload();
  assert.equal(await p.locator(".quantity").innerText(), "2");
  assert.equal(await p.locator("#cart-total").innerText(), total);
});
journey("cart-two-tabs-detect-conflict-and-reload", async (p, c) => {
  await login(c);
  await clearCart(c);
  await add(c);
  await p.goto(base + "/store/cart");
  const other = await c.newPage();
  await other.goto(base + "/store/cart");
  await p.locator(".increase").click();
  await p.waitForFunction(() => document.querySelector(".quantity")?.textContent === "2");
  await other.locator(".increase").click();
  await other.waitForFunction(() => document.querySelector("#cart-error")?.textContent?.includes("409"));
  assert.equal(await other.locator(".quantity").innerText(), "1");
  await other.locator("#cart-reload").click();
  await other.waitForFunction(() => document.querySelector(".quantity")?.textContent === "2");
});
journey("remove-last-cart-line-renders-empty-state", async (p, c) => {
  await login(c);
  await clearCart(c);
  await add(c);
  await p.goto(base + "/store/cart");
  await p.locator(".remove-item").click();
  await p.locator("#empty-cart").waitFor();
  assert.equal(await p.locator("[data-cart-sku]").count(), 0);
  assert.ok(await p.locator("#place-order").isDisabled());
});
journey("checkout-ajax-and-reload-do-not-duplicate-order", async (p, c) => {
  await login(c);
  await clearCart(c);
  await add(c, "sku-3");
  await p.goto(base + "/store/cart");
  await p.locator('input[name="email"]').fill("alice@alpha.test");
  await p.locator('textarea[name="address"]').fill("123 Demo Street");
  await p.locator("#place-order").click();
  await p.waitForURL(/\/store\/orders\//);
  const id = await p.locator("#order-id").innerText();
  await p.reload();
  assert.equal(await p.locator("#order-id").innerText(), id);
  assert.equal((await api<Cart>(c, "/store/api/cart")).data.items.length, 0);
});
journey(
  "checkout-native-without-javascript",
  async (p, c) => {
    await login(c, "editor@alpha.test");
    await clearCart(c);
    await add(c, "sku-4");
    await p.goto(base + "/store/cart");
    await p.locator('input[name="email"]').fill("editor@alpha.test");
    await p.locator('textarea[name="address"]').fill("24 Example Road");
    await p.locator("#place-order").click();
    await p.waitForURL(/\/store\/orders\//);
    assert.ok(await p.locator("#order-id").innerText());
  },
  { javaScriptEnabled: false },
);
journey("tenant-inbox-navigation-and-filter", async (p, c) => {
  await login(c);
  await p.goto(base + "/desk");
  assert.equal(await p.locator("[data-ticket]").count(), 6);
  await p.screenshot({ path: join(app.artifacts, "casework.png"), fullPage: false });
  await p.locator("#ticket-search").fill("Invoice");
  await p.locator("button").filter({ hasText: "Filter" }).click();
  assert.equal(await p.locator("[data-ticket]").count(), 1);
  await p.locator("[data-ticket] h2").click();
  await p.waitForURL(/\/desk\/tickets\/alpha-2/);
});
journey("ticket-edit-persists-and-two-tab-conflict-keeps-text", async (p, c) => {
  await login(c);
  await p.goto(base + "/desk/tickets/alpha-3");
  const other = await c.newPage();
  await other.goto(base + "/desk/tickets/alpha-3");
  await p.locator("#ticket-title").fill("Updated export request");
  await p.locator("#ticket-status").selectOption("pending");
  await p.locator("#save-ticket").click();
  await p.waitForFunction(() => document.querySelector("#ticket-feedback")?.textContent === "Saved");
  await other.locator("#ticket-title").fill("My conflicting draft");
  await other.locator("#save-ticket").click();
  await other.waitForFunction(() => document.querySelector("#ticket-feedback")?.textContent?.includes("409"));
  assert.equal(await other.locator("#ticket-title").inputValue(), "My conflicting draft");
  await p.reload();
  assert.equal(await p.locator("#ticket-title").inputValue(), "Updated export request");
});
journey("live-conversation-two-tabs-no-duplicate-message", async (p, c) => {
  await login(c);
  await p.goto(base + "/desk/tickets/alpha-4");
  const other = await c.newPage();
  await other.goto(base + "/desk/tickets/alpha-4");
  await other.waitForFunction(() => document.querySelector("#live-connection")?.textContent === "Live");
  const text = "A live support reply " + Date.now();
  await p.locator("#reply-body").fill(text);
  await p.locator("#send-reply").click();
  await other.locator(".message p").filter({ hasText: text }).waitFor();
  assert.equal(await other.locator(".message p").filter({ hasText: text }).count(), 1);
  assert.equal(await p.locator(".message p").filter({ hasText: text }).count(), 1);
});
journey("attachment-upload-and-authenticated-download", async (p, c) => {
  await login(c);
  await p.goto(base + "/desk/tickets/alpha-5");
  await p.locator("#attachment").setInputFiles({ name: "browser-note.txt", mimeType: "text/plain", buffer: Buffer.from("Local attachment evidence") });
  await p.locator("#upload-file").click();
  const link = p.locator(".file-download").filter({ hasText: "browser-note.txt" });
  await link.waitFor();
  const pending = p.waitForEvent("download");
  await link.click();
  const download = await pending;
  assert.equal(download.suggestedFilename(), "browser-note.txt");
  assert.equal(await download.failure(), null);
});
journey("viewer-controls-disabled-and-direct-admin-denied", async (p, c) => {
  await login(c, "viewer@alpha.test");
  await p.goto(base + "/desk/tickets/alpha-1");
  assert.ok(await p.locator("#ticket-title").isDisabled());
  assert.ok(await p.locator("#send-reply").isDisabled());
  assert.equal((await p.goto(base + "/desk/admin"))?.status(), 403);
});
journey("editor-autosaves-and-reloads-from-database", async (p, c) => {
  await login(c, "editor@alpha.test");
  await p.goto(base + "/desk/editor");
  const text = "A durable editorial draft " + Date.now();
  const saved = p.waitForResponse((r) => r.url().endsWith("/desk/api/draft") && r.request().method() === "PUT");
  await p.locator("#draft-body").fill(text);
  assert.equal((await saved).status(), 200);
  await p.waitForFunction(() => document.querySelector("#draft-status")?.textContent === "Saved");
  await p.reload();
  assert.equal(await p.locator("#draft-body").inputValue(), text);
});
journey("editor-conflict-preserves-unsaved-local-story", async (p, c) => {
  await login(c, "editor@alpha.test");
  await p.goto(base + "/desk/editor");
  const other = await c.newPage();
  await other.goto(base + "/desk/editor");
  const saved = p.waitForResponse((r) => r.url().endsWith("/desk/api/draft") && r.request().method() === "PUT");
  await p.locator("#draft-title").fill("First tab saved title");
  await saved;
  await other.locator("#draft-body").fill("Do not lose the other tab text");
  await other.locator("#save-draft").click();
  await other.waitForFunction(() => document.querySelector("#draft-status")?.textContent?.includes("409"));
  assert.equal(await other.locator("#draft-body").inputValue(), "Do not lose the other tab text");
});
journey("editor-network-failure-and-explicit-retry", async (p, c) => {
  await login(c, "editor@alpha.test");
  await p.goto(base + "/desk/editor");
  await p.route("**/desk/api/draft", (r) => (r.request().method() === "PUT" ? r.abort("failed") : r.continue()));
  await p.locator("#draft-body").fill("Retained while network is down");
  await p.locator("#save-draft").click();
  await p.waitForFunction(() => document.querySelector("#draft-status")?.textContent?.includes("fetch"));
  assert.equal(await p.locator("#draft-body").inputValue(), "Retained while network is down");
  await p.unroute("**/desk/api/draft");
  const retried = p.waitForResponse((r) => r.url().endsWith("/desk/api/draft") && r.request().method() === "PUT");
  await p.locator("#save-draft").click();
  assert.equal((await retried).status(), 200);
  await p.reload();
  assert.equal(await p.locator("#draft-body").inputValue(), "Retained while network is down");
});
const payloads = [
  '<img src=x onerror="globalThis.__attack=1">',
  "</script><script>globalThis.__attack=1</script>",
  '"><svg onload="globalThis.__attack=1">',
  "&lt;img src=x onerror=globalThis.__attack=1&gt;",
];
for (let i = 0; i < payloads.length; i++)
  journey("stored-XSS-draft-payload-" + i, async (p, c) => {
    await login(c, "editor@alpha.test");
    const draft = (await api<Draft>(c, "/desk/api/draft")).data;
    const result = await api(c, "/desk/api/draft", "PUT", { version: draft.version, title: "Untrusted title " + payloads[i], body: payloads[i] });
    assert.equal(result.status, 200);
    await p.goto(base + "/desk/editor");
    assert.equal(await p.locator("#preview-body").innerText(), payloads[i]);
    assert.equal(await p.locator("#preview-body img,#preview-body svg,#preview-body script").count(), 0);
    assert.equal(await p.evaluate(() => Reflect.get(globalThis, "__attack")), undefined);
    await p.locator("#draft-body").fill(payloads[i] + " client");
    assert.equal(await p.evaluate(() => Reflect.get(globalThis, "__attack")), undefined);
  });
journey("stored-XSS-chat-is-text-after-SSE", async (p, c) => {
  await login(c);
  await p.goto(base + "/desk/tickets/alpha-6");
  await p.waitForFunction(() => document.querySelector("#live-connection")?.textContent === "Live");
  const payload = payloads[0] + " live-" + Date.now();
  assert.equal(await p.locator(".message p").filter({ hasText: payload }).count(), 0);
  await api(c, "/desk/api/messages/alpha-6", "POST", { body: payload });
  await p.locator(".message p").filter({ hasText: payload }).waitFor();
  assert.equal(await p.locator(".message img").count(), 0);
  assert.equal(await p.evaluate(() => Reflect.get(globalThis, "__attack")), undefined);
});
journey("reflected-XSS-query-does-not-escape-input", async (p) => {
  await p.goto(base + "/store?q=" + encodeURIComponent(payloads[2]));
  assert.equal(await p.locator("#shop-search").inputValue(), payloads[2]);
  assert.equal(await p.evaluate(() => Reflect.get(globalThis, "__attack")), undefined);
});
journey("logout-back-reload-cannot-reopen-private-workspace", async (p, c) => {
  await login(c);
  await p.goto(base + "/desk/editor");
  await p.locator("#logout").click();
  await p.waitForURL(/\/sign-in/);
  await p.goBack();
  assert.ok(!(await p.locator("body").innerText()).includes("PRIVATE DRAFT"), "Back must not restore the private editor after logout");
  await p.reload();
  assert.ok(!(await p.locator("body").innerText()).includes("PRIVATE DRAFT"));
  assert.equal((await c.request.get(base + "/desk")).status(), 401);
});
journey("dispatch-search-pagination-story-and-history", async (p) => {
  await p.goto(base + "/dispatch");
  await p.screenshot({ path: join(app.artifacts, "dispatch.png"), fullPage: false });
  await p.locator("#article-search").fill("security");
  await p.locator("#article-filter").click();
  await p.waitForURL(/q=security/);
  assert.equal(await p.locator(".article-card").count(), 6);
  await p.locator("#article-next").click();
  await p.waitForFunction(() => document.querySelector("#article-page")?.textContent === "Page 2 of 2");
  const title = await p.locator(".article-card h2").first().innerText();
  await p.locator(".read-story").first().click();
  await p.waitForURL(/\/dispatch\/dispatch-/);
  assert.equal(await p.locator("#story-title").innerText(), title);
  assert.ok((await p.title()).includes(title));
  await p.goBack();
  assert.equal(await p.locator("#article-page").innerText(), "Page 2 of 2");
});
journey(
  "public-article-works-without-javascript",
  async (p) => {
    await p.goto(base + "/dispatch/dispatch-1");
    assert.match(await p.locator("#story-title").innerText(), /Security/);
    assert.ok((await p.locator(".article-prose").innerText()).includes("Permissions"));
  },
  { javaScriptEnabled: false },
);
journey(
  "mobile-workspace-and-editor-do-not-overflow",
  async (p, c) => {
    await login(c);
    await p.goto(base + "/desk/editor");
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  },
  { viewport: { width: 390, height: 844 } },
);

// Serial execution preserves deliberate cross-case database edits while contexts isolate sessions.
test.each(journeys)("$name", { concurrent: false }, async ({ name, run, options }) => {
  assert.ok(browser, "The production browser fixture must be running");
  const context = await browser.newContext(options);
  context.setDefaultTimeout(8_000);
  context.setDefaultNavigationTimeout(15_000);
  const errors: string[] = [];
  context.on("page", (page) => page.on("pageerror", (error) => errors.push(error.message)));
  try {
    const page = await context.newPage();
    try {
      await run(page, context);
      assert.deepEqual(errors, [], "Browser journeys must not emit uncaught page errors");
    } catch (error) {
      await page.screenshot({ path: join(app.artifacts, `${name}.png`), fullPage: false }).catch(() => {});
      throw error;
    }
  } finally {
    await context.close();
  }
});
