// Per-submit cost of the drawer demo in Chromium: bytes on the wire, DOM mutations, time to the
// updated list, and what survives (drawer open, page-local state). `node libs/forms/tests/drawer-app/measure.ts`
// (builds first; `--no-build` reuses dist/). JSON on stdout.
import { chromium, type Page } from "playwright";
import { start } from "@rivetjs/router/node";
import { buildApp, dist } from "./serve.ts";

const root = new URL("./", import.meta.url).pathname;
if (!process.argv.includes("--no-build")) await buildApp();
const app = await start({ dist, port: Number(process.env.PORT ?? 4642), host: "127.0.0.1", onError: () => {} });
const browser = await chromium.launch({ headless: true, args: ["--use-mock-keychain", "--password-store=basic"] });

type Sample = {
  requests: { method: string; url: string; type: string; bytes: number }[];
  mutations: Record<string, number> | null;
  ms: number;
  documents: number;
};

function record(page: Page) {
  const requests: Sample["requests"] = [];
  page.on("requestfinished", async (request) => {
    const sizes = await request.sizes().catch(() => undefined);
    requests.push({
      method: request.method(),
      url: new URL(request.url()).pathname + new URL(request.url()).search,
      type: request.resourceType(),
      bytes: sizes?.responseBodySize ?? 0,
    });
  });
  return requests;
}

async function mutations(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Node adds / removes + attribute / text writes, by area: the list, the layout total, the rest (drawer, page).
    const w = window as unknown as { __m: Record<string, number> };
    w.__m = { list: 0, total: 0, other: 0 };
    new MutationObserver((list) => {
      for (const record of list) {
        const at = record.target instanceof Element ? record.target : record.target.parentElement;
        const area = at?.closest("#customers") ? "list" : at?.closest("#total") ? "total" : "other";
        w.__m[area]! += record.type === "childList" ? record.addedNodes.length + record.removedNodes.length : 1;
      }
    }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  });
}

async function submit(page: Page, name: string, email: string, until: () => Promise<unknown>, js: boolean): Promise<Sample> {
  const requests = record(page);
  let documents = 0;
  page.on("request", (request) => request.resourceType() === "document" && documents++);
  if (js) await mutations(page);
  await page.fill("#customer-name", name);
  await page.fill("#customer-email", email);
  const t0 = Date.now();
  await page.click("#save");
  await until();
  const ms = Date.now() - t0;
  await page.waitForTimeout(300);
  const count = js ? await page.evaluate(() => (window as unknown as { __m: Record<string, number> }).__m) : null;
  return { requests: [...requests], mutations: count, ms, documents };
}

const rows = (page: Page) => page.locator("#customers li").count();
const state = async (page: Page) => ({
  drawerOpen: await page
    .locator("#drawer")
    .isVisible()
    .catch(() => false),
  clicks: await page.textContent("#clicks"),
  total: await page.textContent("#total"),
  rows: await rows(page),
  url: page.url().replace(app.url, ""),
});

const out: Record<string, unknown> = {};
{
  // JavaScript: resumed page, page-local state, drawer opened by the button.
  const page = await browser.newPage();
  await page.goto(app.url + "/");
  await page.waitForTimeout(300);
  await page.click("#clicks");
  await page.click("#clicks");
  await page.click("#new");
  await page.waitForSelector("#drawer");
  const before = await rows(page);
  const invalid = await submit(page, "Ada Two", "ada@example.com", () => page.waitForSelector("#customer-email-error:has-text('already')"), true);
  out.jsInvalid = { ...invalid, after: await state(page) };
  const valid = await submit(
    page,
    "Linus",
    "linus@example.com",
    () => page.waitForFunction((n) => document.querySelectorAll("#customers li").length > n, before),
    true,
  );
  out.jsValid = { ...valid, after: await state(page) };
  // Warm: second add (handlers, chunks and list rows already client-side).
  await page.click("#new");
  await page.waitForSelector("#drawer");
  const warm = await submit(
    page,
    "Ken",
    "ken@example.com",
    () => page.waitForFunction((n) => document.querySelectorAll("#customers li").length > n, before + 1),
    true,
  );
  out.jsWarm = { ...warm, after: await state(page) };
  await page.close();
}
{
  // No JavaScript: `?new` renders the drawer open; the POST answers a full document.
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(app.url + "/?new");
  const before = await rows(page);
  const invalid = await submit(page, "Ada Two", "ada@example.com", () => page.waitForSelector("#customer-email-error"), false);
  out.noJsInvalid = { ...invalid, after: await state(page) };
  const valid = await submit(
    page,
    "Margaret",
    "margaret@example.com",
    () => page.waitForFunction((n) => document.querySelectorAll("#customers li").length > n, before),
    false,
  );
  out.noJsValid = { ...valid, after: await state(page) };
  await context.close();
}
console.log(JSON.stringify(out, null, 2));
await browser.close();
await app.close();
