// Production app contracts: JS-off CRUD, validation, cold overlays and live page/layout updates.
import { afterAll, beforeAll, test } from "vitest";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("..", import.meta.url));
const cwd = process.cwd();
const base = "http://127.0.0.1:4474";
let serving: { close(): Promise<unknown> } | undefined;

beforeAll(async () => {
  const bin = ["node_modules/vite/bin/vite.js", "../../node_modules/vite/bin/vite.js"].map((p) => join(root, p)).find(existsSync)!;
  for (const args of [["build"], ["build", "--ssr"]])
    execFileSync(process.execPath, [bin, ...args], { cwd: root, stdio: "pipe", env: { ...process.env, NODE_ENV: "production" } });
  process.chdir(root);
  const { start } = await import("@rivetjs/router/node");
  serving = await start({ dist: join(root, "dist"), port: 4474, host: "127.0.0.1" });
}, 180_000);
afterAll(async () => {
  await serving?.close();
  process.chdir(cwd);
});

const post = (action: string, values: Record<string, string>) =>
  fetch(`${base}/?/${action}`, { method: "POST", body: new URLSearchParams(values), headers: { origin: base }, redirect: "manual" });
const htmlOf = async (response: Response) => (await response.text()).replace(/<!--.*?-->/g, "");

test("JS-off create, edit and delete return to the updated list", async () => {
  const created = await post("create", { name: "Zoe Test", email: "zoe@example.com", company: "" });
  assert.equal(created.status, 303);
  const html = await htmlOf(await fetch(base));
  assert.match(html, /Zoe Test/);
  assert.match(html, /id="total">6</);
  // Read the exact row containing Zoe, rather than accidentally using an earlier row's id.
  const rowId = [...html.matchAll(/<li[^>]*data-id="(\d+)"[^>]*>([\s\S]*?)<\/li>/g)].find((m) => m[2]!.includes("Zoe Test"))?.[1];
  assert.ok(rowId);
  const edit = await htmlOf(await fetch(`${base}/?edit=${rowId}`));
  assert.match(edit, /value="Zoe Test"/);
  assert.equal((await post("update", { id: rowId, name: "Zoe Updated", email: "zoe@example.com", company: "Acme" })).status, 303);
  assert.match(await htmlOf(await fetch(base)), /Zoe Updated/);
  assert.equal((await post("remove", { id: rowId })).status, 303);
  const removed = await htmlOf(await fetch(base));
  assert.doesNotMatch(removed, /Zoe Updated/);
  assert.match(removed, /id="total">5</);
});

test("server validation keeps the submitted values and reports duplicate email", async () => {
  const invalid = await post("create", { name: "", email: "invalid", company: "Kept company" });
  assert.equal(invalid.status, 400);
  const html = await htmlOf(invalid);
  assert.match(html, /Enter a name/);
  assert.match(html, /Enter an email address/);
  assert.match(html, /value="Kept company"/);
  const duplicate = await post("create", { name: "Duplicate", email: "ADA@northwind.example", company: "" });
  assert.equal(duplicate.status, 400);
  assert.match(await htmlOf(duplicate), /That email already belongs to a contact/);
  const update = await post("update", { id: "1", name: "Ada Brooks", email: "bruno@lumen.example", company: "Edited company" });
  assert.equal(update.status, 400);
  assert.match(await htmlOf(update), /value="Edited company"/);
  const missing = await post("update", { id: "9999", name: "Missing", email: "missing@example.com", company: "" });
  assert.equal(missing.status, 400);
  assert.match(await htmlOf(missing), /This contact no longer exists/);
});

test("forms work in visible overlays with JavaScript disabled", async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ javaScriptEnabled: false });
    page.setDefaultTimeout(10_000);
    await page.goto(base);
    await page.locator("#new").click();
    await page.getByText("Cancel", { exact: true }).click();
    await page.locator("#create-save").waitFor({ state: "hidden" });
    await page.locator("#new").click();
    await page.locator("#create-name").fill("No JS Contact");
    await page.locator("#create-email").fill("nojs@example.com");
    await page.locator("#create-save").click();
    await page.getByRole("link", { name: "Edit No JS Contact", exact: true }).click();
    await page.getByText("Cancel", { exact: true }).click();
    await page.locator("#edit-save").waitFor({ state: "hidden" });
    await page.getByRole("link", { name: "Edit No JS Contact", exact: true }).click();
    await page.locator("#edit-name").fill("No JS Updated");
    await page.locator("#edit-save").click();
    await page.getByRole("link", { name: "Delete No JS Updated", exact: true }).click();
    await page.getByText("Cancel", { exact: true }).click();
    await page.getByRole("link", { name: "Delete No JS Updated", exact: true }).click();
    await page.locator("#delete-confirm").click();
    assert.doesNotMatch(await page.locator("#contacts").innerText(), /No JS Updated/);
  } finally {
    await browser.close();
  }
});

test("cross-site mutations are rejected and bootstrap script assets stay within budget", async () => {
  const rejected = await fetch(`${base}/?/remove`, {
    method: "POST",
    body: new URLSearchParams({ id: "1" }),
    headers: { origin: "http://evil.example" },
    redirect: "manual",
  });
  assert.equal(rejected.status, 403);
  assert.equal((await fetch(base + "/healthz")).status, 200);
  const html = await htmlOf(await fetch(base));
  let bytes = 0;
  for (const match of html.matchAll(/<script\b[^>]*src="([^"]+\.js)"/g)) {
    const asset = await fetch(new URL(match[1]!, base));
    assert.equal(asset.status, 200);
    bytes += (await asset.arrayBuffer()).byteLength;
  }
  assert.ok(bytes <= 40 * 1024, `bootstrap scripts: ${bytes} bytes > 40 KB`);
});

test("cold drawer submits keep errors open and refresh list/layout without replacing the page", async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(10_000);
    const errors: string[] = [];
    const documents: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (request.resourceType() === "document") documents.push(request.url());
    });
    await page.goto(base);
    const total = Number(await page.locator("#total").innerText());
    await page.evaluate(() => document.querySelector("main")!.setAttribute("data-kept", "yes"));
    await page.locator("#new").click();
    await page.locator("#create-name").fill("Browser Contact");
    await page.locator("#create-email").fill("ada@northwind.example");
    await page.locator("#create-save").click();
    await page.getByText("That email already belongs to a contact", { exact: true }).waitFor();
    assert.equal(await page.locator("#create-name").inputValue(), "Browser Contact");
    await page.locator("#create-email").fill("browser@example.com");
    await page.locator("#create-save").click();
    await page.waitForFunction((n) => document.querySelector("#total")?.textContent === String(n + 1), total);
    await page.locator("#create-save").waitFor({ state: "hidden" });
    await page.locator("#new").click();
    assert.equal(await page.locator("#create-name").inputValue(), "");
    assert.equal(await page.getByText("That email already belongs to a contact", { exact: true }).count(), 0);
    await page.keyboard.press("Escape");
    await page.locator("#create-save").waitFor({ state: "hidden" });
    await page.getByRole("link", { name: "Edit Browser Contact", exact: true }).click();
    await page.locator("#edit-name").fill("Browser Updated");
    await page.locator("#edit-save").click();
    await page.getByRole("link", { name: "Delete Browser Updated", exact: true }).click();
    await page.locator("#delete-confirm").click();
    await page.waitForFunction((n) => document.querySelector("#total")?.textContent === String(n), total);
    assert.equal(await page.locator("main").getAttribute("data-kept"), "yes");
    assert.deepEqual(documents, [base + "/"]);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test("editing successive contacts submits the selected id and fresh initial fields", async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(10_000);
    const documents: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "document") documents.push(request.url());
    });
    await page.goto(base);
    await page.getByRole("link", { name: "Edit Ada Brooks", exact: true }).click();
    assert.equal(await page.locator("#update input[name=id]").inputValue(), "1");
    assert.equal(await page.locator("#edit-email").inputValue(), "ada@northwind.example");
    await page.keyboard.press("Escape");
    await page.locator("#edit-save").waitFor({ state: "hidden" });
    await page.getByRole("link", { name: "Edit Bruno Diaz", exact: true }).click();
    assert.equal(await page.locator("#update input[name=id]").inputValue(), "2");
    assert.equal(await page.locator("#edit-email").inputValue(), "bruno@lumen.example");
    await page.locator("#edit-company").fill("Updated Lumen");
    await page.locator("#edit-save").click();
    await page.locator("#edit-save").waitFor({ state: "hidden" });
    assert.match(await page.locator('[data-id="2"]').innerText(), /Updated Lumen/);
    assert.match(await page.locator('[data-id="1"]').innerText(), /Northwind/);
    assert.deepEqual(documents, [base + "/"], "a hidden name=id must not disable enhanced submission");
  } finally {
    await browser.close();
  }
});

test("a failed request explains the error, keeps typed values and allows retry", async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(10_000);
    await page.goto(base);
    await page.locator("#new").click();
    await page.locator("#create-name").fill("Retry Contact");
    await page.locator("#create-email").fill("retry@example.com");
    const actionURL = (url: URL) => url.search === "?/create";
    await page.route(actionURL, (route) => route.abort("failed"));
    await page.locator("#create-save").click();
    await page.getByRole("status").filter({ hasText: "Failed to fetch" }).waitFor();
    assert.equal(await page.locator("#create-name").inputValue(), "Retry Contact");
    assert.equal(await page.locator("#create-email").inputValue(), "retry@example.com");
    await page.unroute(actionURL);
    await page.locator("#create-save").click();
    await page.locator("#create-save").waitFor({ state: "hidden" });
    await page.getByRole("link", { name: "Delete Retry Contact", exact: true }).click();
    await page.locator("#delete-confirm").click();
    await page.locator("#delete-confirm").waitFor({ state: "hidden" });
  } finally {
    await browser.close();
  }
});
