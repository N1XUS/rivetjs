// Framework panes end to end on the Vite dev server (copies of the router, forms and i18n fixture
// apps, driven in Chromium): Router (route, params, loader data, layout chain, navigations), Forms
// (values, dirty / touched fields, issues, autosave) and i18n (locale, catalogs, missing keys).
import { test } from "vitest";
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";
import { chromium, type FrameLocator, type Page } from "playwright";

const libs = new URL("../../", import.meta.url).pathname;

async function copy(fixture: string): Promise<string> {
  await mkdir(".artifacts", { recursive: true });
  const root = await mkdtemp(resolve(".artifacts/devtools-e2e-"));
  await cp(libs + fixture, root, { recursive: true, filter: (path) => !/[/\\](\.rivet|dist|node_modules)$/.test(path) });
  return root;
}
async function session(root: string, path: string) {
  const server = await createServer({ root, configFile: resolve(root, "vite.config.ts"), logLevel: "silent", server: { port: 0 } });
  await server.listen();
  const origin = server.resolvedUrls!.local[0]!.replace(/\/$/, "");
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(origin + path);
  await page.keyboard.press("Alt+Shift+R");
  const panel = page.frameLocator("rivet-devtools iframe");
  await panel.locator(".tabs").waitFor();
  return {
    page,
    panel,
    pageErrors,
    close: async () => {
      await browser.close();
      await server.close();
      await rm(root, { recursive: true, force: true });
    },
  };
}
const shot = (page: Page, name: string) => page.screenshot({ path: `.artifacts/devtools-${name}.png` });
const tab = (panel: FrameLocator, name: string) => panel.locator(`[data-tab="${name}"]`).click();

test("Router pane: shown route, params, loader data per layout, layout chain, navigations", async () => {
  const { page, panel, pageErrors, close } = await session(await copy("router/tests/fixture/"), "/items/1");
  try {
    await page.locator("#item-id", { hasText: "1" }).waitFor();
    await tab(panel, "router");
    const pane = panel.locator(".router-pane");
    await pane.locator('.route[data-pattern="/items/:id"]').waitFor();
    assert.equal(await pane.locator(".params .value").textContent(), '{"id":"1"}');
    assert.deepEqual(await pane.locator(".layouts .layout-id").allTextContents(), ["/", "page"]);
    assert.deepEqual(await pane.locator(".loader-data > li").evaluateAll((rows) => rows.map((r) => r.getAttribute("data-id"))), ["/", "page"]);
    await pane.locator('.loader-data li[data-id="page"] .value', { hasText: "{id, title, loads}" }).waitFor();
    // Client navigation: the pane follows, and the navigation is listed with its timing.
    await page.click('a[href="/items/2"]');
    await page.locator("#item-id", { hasText: "2" }).waitFor();
    await pane.locator(".params .value", { hasText: '{"id":"2"}' }).waitFor();
    const nav = pane.locator(".navs tbody tr").first();
    await nav.waitFor();
    assert.deepEqual((await nav.locator("td").allTextContents()).slice(0, 4), ["/items/2", "/items/1", "push", "link"]);
    assert.match((await nav.locator("td.n").textContent()) ?? "", /^\d+ ms$/);
    // The router's own contexts carry their names (RouteParams is provided only for apps using useParams()).
    await tab(panel, "contexts");
    await panel.locator('tr.provider[data-context="ServerData"]').first().waitFor();
    await tab(panel, "router");
    await shot(page, "router");
    assert.deepEqual(pageErrors, []);
  } finally {
    await close();
  }
});

test("Forms pane: live values (passwords masked), dirty and touched fields, issues; autosave state", async () => {
  const { page, panel, pageErrors, close } = await session(await copy("forms/tests/app/"), "/signup");
  try {
    await page.locator("form").first().waitFor();
    await tab(panel, "forms");
    const form = panel.locator('li.form[data-form="signup"]');
    await form.waitFor();
    await page.fill('input[name="name"]', "Ada");
    await page.fill('input[name="password"]', "hunter22");
    await page.locator('input[name="password"]').blur();
    await form.locator(".dirty .value", { hasText: "name" }).waitFor();
    assert.match((await form.locator(".dirty .value").textContent()) ?? "", /password/);
    await form.locator(".touched .value", { hasText: "password" }).waitFor();
    // Values: expand the tree; the password is masked.
    await form.locator(".values li.vnode > .vline > button.toggle").first().click();
    await form.locator('.values li.vnode[data-key="name"] .value', { hasText: '"Ada"' }).waitFor();
    assert.equal(await form.locator('.values li.vnode[data-key="password"] .value').textContent(), '"••••••"');
    // Issues after a submit.
    await page.fill('input[name="email"]', "not-an-email");
    // Implicit submission (Enter in a field): the submit button can sit under the docked panel (CI: Linux font metrics
    // push it there and the click never lands).
    await page.press('input[name="email"]', "Enter");
    await form.locator('.issues li[data-path="email"] .error').waitFor();
    // (A submit the client rejects never posts: the submit count stays 0.)
    assert.match((await form.locator(".state .value").textContent()) ?? "", /submits \d+/);
    await shot(page, "forms");

    // Autosave without a form store: its status and unsaved field count.
    await page.goto(page.url().replace(/\/signup$/, "/draft"));
    await page.locator("#draft-body").waitFor();
    // The panel reopens by itself after a reload.
    const again = page.frameLocator("rivet-devtools iframe");
    await again.locator(".tabs").waitFor();
    await tab(again, "forms");
    const draft = again.locator('li.form[data-form="demo-draft"]');
    await draft.waitFor();
    await page.fill("#draft-body", "hello");
    await draft.locator(".autosave .value", { hasText: "unsaved · 1 unsaved" }).waitFor();
    assert.deepEqual(pageErrors, []);
  } finally {
    await close();
  }
});

test("i18n pane: locale and direction, catalogs, missing keys this session", async () => {
  const root = await copy("i18n/tests/fixture-app/");
  // A prefixed lookup (`t(\`menu.${key}\`)`) whose key can go missing at runtime.
  for (const [locale, home] of [["en", "Home"], ["de", "Start"]] as const) {
    const file = resolve(root, `locales/${locale}.json`);
    const catalog = JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>;
    await writeFile(file, JSON.stringify({ ...catalog, menu: { home } }));
  }
  const page = resolve(root, "src/routes/[[lang]]/index.tsx");
  await writeFile(
    page,
    (await readFile(page, "utf8"))
      .replace("const n = signal(1);", 'const n = signal(1);\n  const item = signal("home");')
      .replace("</main>", '  <p id="menu">{t(`menu.${item()}`)}</p>\n        <button type="button" id="miss" onClick={() => item.set("nope")}>miss</button>\n      </main>'),
  );
  const s = await session(root, "/de");
  try {
    await s.page.locator("#menu", { hasText: "Start" }).waitFor();
    await tab(s.panel, "i18n");
    const pane = s.panel.locator(".i18n-pane");
    await pane.locator(".locale .value", { hasText: "de" }).waitFor();
    assert.equal(await pane.locator(".dir .value").textContent(), "ltr");
    assert.deepEqual(await pane.locator(".catalogs tbody tr").evaluateAll((rows) => rows.map((r) => r.getAttribute("data-locale"))), ["en", "de"]);
    await s.page.click("#miss");
    await pane.locator('.missing li[data-key="menu.nope"]').waitFor();
    await shot(s.page, "i18n");
    assert.deepEqual(s.pageErrors, []);
  } finally {
    await s.close();
  }
});
