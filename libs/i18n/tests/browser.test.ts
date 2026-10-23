// End to end: per-locale client builds plus one server build of a file-routed app, served by the
// node adapter and driven in Chromium.
import { test, beforeAll as before, afterAll as after } from "vitest";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build, createServer } from "vite";
import type { AddressInfo } from "node:net";
import { chromium, type Browser } from "playwright";
import { start } from "@rivetjs/router/node";

const root = fileURLToPath(new URL("./fixture-app/", import.meta.url));
const configFile = root + "vite.config.ts";
let browser: Browser | undefined, app: { url: string; close(): Promise<void> } | undefined;

before(async () => {
  await rm(root + "dist", { recursive: true, force: true });
  try {
    for (const locale of ["en", "de"]) {
      process.env.RIVET_LOCALE = locale;
      await build({ root, configFile, logLevel: "silent" });
    }
  } finally {
    delete process.env.RIVET_LOCALE;
  }
  await build({ root, configFile, logLevel: "silent", build: { ssr: true } });
  app = await start({ dist: root + "dist", port: 0, locales: ["en", "de"], onError: () => {} });
  browser = await chromium.launch({ headless: true });
});
after(async () => {
  await browser?.close();
  await app?.close();
});

test("de page: html lang, inlined text, only de chunks, no message state, resumes in German", async () => {
  const page = await browser!.newPage();
  const scripts: string[] = [];
  page.on("request", (r) => r.resourceType() === "script" && scripts.push(new URL(r.url()).pathname));
  const response = await page.goto(app!.url + "/de");
  assert.equal(response?.headers()["content-language"], "de");
  assert.equal(await page.getAttribute("html", "lang"), "de");
  assert.equal(await page.textContent("h1"), "Warenkorb");
  const html = await response!.text();
  const state = html.match(/<script type="rivet\/boundaries"[^>]*>([^<]*)<\/script>/)?.[1] ?? "";
  assert.ok(state, "page carries resume state");
  assert.doesNotMatch(state, /Warenkorb|Artikel|cart\./);
  // Tags inside plural cases: server markup, then the resumed binding re-renders it in German.
  assert.match(html, /<p><!--[^>]*--><b>1<\/b> Artikel<!--[^>]*--><\/p>|<p><b>1<\/b> Artikel<\/p>/);
  // Rich messages (top-level tags) passed as props: server markup, then the resumed binding.
  assert.match(html.replace(/<!--.*?-->/g, ""), /<small[^>]*>Fragen\? <a href="\/help">Kontakt<\/a><\/small>/);
  assert.match(html.replace(/<!--.*?-->/g, ""), /<aside[^>]*>Siehe <a href="\/terms">AGB<\/a> für 1 Artikel<\/aside>/);
  await page.click("button");
  await page.waitForFunction(() => document.querySelector("button")?.textContent?.trim() === "2 Artikel");
  await page.waitForFunction(() => document.querySelector("p")?.innerHTML.replace(/<!--.*?-->/g, "") === "<b>2</b> Artikel im Korb");
  await page.waitForFunction(() => document.querySelector("aside")?.innerHTML.replace(/<!--.*?-->/g, "") === 'Siehe <a href="/terms">AGB</a> für 2 Artikel');
  assert.ok(scripts.length > 0 && scripts.every((p) => p.startsWith("/de/")), scripts.join(","));
});

test("default locale has no prefix; root redirects by Accept-Language", async () => {
  const en = await fetch(app!.url + "/", { headers: { "accept-language": "en" }, redirect: "manual" });
  assert.equal(en.status, 200);
  assert.match(await en.text(), /<h1>Cart<\/h1>/);
  const ctx = await browser!.newContext({ locale: "de-DE" });
  try {
    const page = await ctx.newPage();
    await page.goto(app!.url + "/");
    assert.equal(new URL(page.url()).pathname, "/de");
    assert.equal(await page.textContent("h1"), "Warenkorb");
  } finally {
    await ctx.close();
  }
  assert.equal((await fetch(app!.url + "/zz", { redirect: "manual" })).status, 404);
});

test("switching to the default locale by a link sticks: the guard sets the locale cookie", async () => {
  const ctx = await browser!.newContext({ locale: "de-DE" });
  try {
    const page = await ctx.newPage();
    await page.goto(app!.url + "/");
    assert.equal(new URL(page.url()).pathname, "/de");
    assert.deepEqual(await ctx.cookies(), [], "detection sets no cookie");
    // The language switcher: a plain same-site link to the unprefixed (English) URL.
    await page.evaluate(() => {
      const a = document.createElement("a");
      a.href = "/";
      a.id = "to-en";
      a.textContent = "English";
      document.body.append(a);
    });
    const [response] = await Promise.all([page.waitForNavigation(), page.click("#to-en")]);
    assert.equal(new URL(page.url()).pathname, "/");
    assert.equal(await page.textContent("h1"), "Cart");
    assert.match((await response!.allHeaders())["set-cookie"] ?? "", /^rivet_locale=en; Path=\/; SameSite=Lax$/);
    const [cookie] = await ctx.cookies();
    assert.deepEqual([cookie?.name, cookie?.value, cookie?.httpOnly, cookie?.sameSite, cookie?.expires], ["rivet_locale", "en", false, "Lax", -1]);
    // A later visit by typed URL (no Sec-Fetch-Site: same-origin) stays English.
    const later = await ctx.newPage();
    const again = await later.goto(app!.url + "/");
    assert.equal(new URL(later.url()).pathname, "/");
    assert.equal(await later.textContent("h1"), "Cart");
    assert.equal((await again!.allHeaders())["set-cookie"], undefined, "unchanged cookie is not rewritten");
  } finally {
    await ctx.close();
  }
});

test("hreflang alternates present", async () => {
  const html = await (await fetch(app!.url + "/de")).text();
  const hreflangs = [...html.matchAll(/<link rel="alternate" href="([^"]+)" hreflang="([^"]+)">/g)].map((m) => [m[2], m[1]]);
  assert.deepEqual(hreflangs, [
    ["en", "https://shop.test/"],
    ["de", "https://shop.test/de"],
    ["x-default", "https://shop.test/"],
  ]);
});

test("dev server: the client renders and updates in the page's locale", async () => {
  const server = await createServer({ root, configFile, logLevel: "silent", server: { port: 0, hmr: false } });
  await server.listen();
  const page = await browser!.newPage();
  try {
    const address = server.httpServer!.address() as AddressInfo;
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const response = await page.goto(`http://localhost:${address.port}/de`);
    assert.match(await response!.text(), /<html lang="de"[^>]*>[\s\S]*Warenkorb[\s\S]*dev-mount\.tsx\?rivet-locale=de/);
    await page.waitForFunction(() => document.querySelector("button")?.textContent?.trim() === "1 Artikel");
    await page.click("button");
    await page.waitForFunction(() => document.querySelector("button")?.textContent?.trim() === "2 Artikel");
    await page.waitForFunction(() => document.querySelector("p")?.innerHTML.replace(/<!--.*?-->/g, "") === "<b>2</b> Artikel im Korb");
    // The client-rendered (DOM) rich message props.
    assert.equal((await page.innerHTML("small")).replace(/<!--.*?-->/g, ""), 'Fragen? <a href="/help">Kontakt</a>');
    await page.waitForFunction(() => document.querySelector("aside")?.innerHTML.replace(/<!--.*?-->/g, "") === 'Siehe <a href="/terms">AGB</a> für 2 Artikel');
    assert.equal(await page.textContent("h1"), "Warenkorb");
    assert.deepEqual(errors, []);
    const en = await (await fetch(`http://localhost:${address.port}/`, { headers: { "accept-language": "en" } })).text();
    // The default locale resumes (dev entry); non-default locales client-render (dev mount).
    assert.match(en, /entry\.dev\.tsx"/);
  } finally {
    await page.close();
    await server.close();
  }
});

test("dev server: a link to another locale loads its document, as in a build (no client navigation with the old locale's code)", async () => {
  const server = await createServer({ root, configFile, logLevel: "silent", server: { port: 0, hmr: false } });
  await server.listen();
  const page = await browser!.newPage();
  try {
    const { port } = server.httpServer!.address() as AddressInfo;
    const documents: string[] = [];
    page.on("request", (r) => r.resourceType() === "document" && documents.push(new URL(r.url()).pathname));
    await page.goto(`http://localhost:${port}/`, { waitUntil: "networkidle" });
    assert.equal(await page.getAttribute("html", "lang"), "en");
    // A plain link without data-rivet-reload, as a language switcher would render it.
    await page.evaluate(() => {
      const a = Object.assign(document.createElement("a"), { href: "/de", id: "to-de", textContent: "Deutsch" });
      document.body.append(a);
    });
    await page.click("#to-de");
    await page.waitForFunction(() => document.documentElement.lang === "de");
    assert.deepEqual(documents, ["/", "/de"]);
    await page.waitForFunction(() => document.querySelector("h1")?.textContent === "Warenkorb");
  } finally {
    await page.close();
    await server.close();
  }
});

test("the _404 page of an unmatched URL takes the locale of its prefix, in dev and in a build", async () => {
  const server = await createServer({ root, configFile, logLevel: "silent", server: { port: 0, hmr: false } });
  await server.listen();
  try {
    const { port } = server.httpServer!.address() as AddressInfo;
    const response = await fetch(`http://localhost:${port}/de/nope`, { headers: { "accept-language": "en" } });
    assert.equal(response.status, 404);
    assert.match(await response.text(), /<html lang="de"/);
    const built = await fetch(app!.url + "/de/nope", { headers: { "accept-language": "en" } });
    assert.equal(built.status, 404);
    assert.match(await built.text(), /<html lang="de"/);
  } finally {
    await server.close();
  }
});
