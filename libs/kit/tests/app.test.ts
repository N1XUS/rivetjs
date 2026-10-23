// Kit fixture end to end: component head, css`` and CSS module per-route stylesheets, script
// strategies under a strict nonce CSP with Trusted Types, and client navigation head updates.
import { test } from "vitest";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { build, createServer } from "vite";
import { chromium } from "playwright";
import { start } from "@rivetjs/router/node";
import { strictCSP } from "@rivetjs/router/server";

const root = new URL("./fixture/", import.meta.url).pathname;
const configFile = root + "vite.config.ts";

test("dev: component head and the route's stylesheets render on the server", async () => {
  const server = await createServer({ root, configFile, logLevel: "silent", server: { port: 0 } });
  await server.listen();
  const origin = server.resolvedUrls!.local[0]!.replace(/\/$/, "");
  try {
    const html = await (await fetch(origin + "/")).text();
    assert.match(html, /<title>Home \| Kit<\/title>/, html);
    assert.match(html, /<meta name="description" content="Home page" data-rh="">/);
    assert.match(html, /<meta name="theme-color" content="#123456" data-rh="0">/);
    assert.match(html, /<link rel="stylesheet" href="\/src\/routes\/index\.tsx\.rivet\.css\?direct">/);
    const about = await (await fetch(origin + "/about")).text();
    assert.match(about, /<title>About \| Kit<\/title>/);
    assert.match(about, /<link rel="stylesheet" href="\/src\/routes\/about\.module\.css\?direct">/);
    assert.doesNotMatch(about, /index\.tsx\.rivet\.css/);
  } finally {
    await server.close();
  }
});

test("production: head in capo order, per-route CSS, nonce'd scripts, client navigation updates the head", async () => {
  await rm(root + "dist", { recursive: true, force: true });
  await build({ root, configFile, logLevel: "silent" });
  await build({ root, configFile, logLevel: "silent", build: { ssr: true } });
  const app = await start({ dist: root + "dist", port: 0, onError: () => {} });
  const browser = await chromium.launch({ headless: true });
  try {
    // Shell cache (`/shell`, PPR-T57): a hole's head components on an H-holes hit write what a fresh render writes — the
    // body-valid tags in place with the hit's own nonce; `<Title>` inside the hole is ignored (warned once).
    const warn = console.warn;
    const warned: string[] = [];
    console.warn = (...args: unknown[]) => void warned.push(args.join(" "));
    try {
      const shellOf = async (expected: string | null) => {
        const response = await fetch(app.url + "/shell");
        assert.equal(response.headers.get("x-rivet-cache"), expected);
        const nonce = /'nonce-([^']+)'/.exec(response.headers.get("content-security-policy") ?? "")![1]!;
        return { html: await response.text(), nonce };
      };
      await shellOf(null); // the doorkeeper: stored on the second miss
      const fill = await shellOf("SHELL-MISS");
      const hit = await shellOf("SHELL-HIT");
      for (const { html, nonce } of [fill, hit]) {
        assert.match(html, /<title>Shell \| Kit<\/title>/);
        const late = /<script\b[^>]* src="\/late-hole\.js"[^>]*>/.exec(html)?.[0]; // the nonce is base64 (`+`): no RegExp from it
        assert.ok(late?.includes(`nonce="${nonce}"`), html);
        assert.match(html, /<link rel="prefetch" href="\/next\.json"/);
        for (const tag of html.match(/<script\b[^>]*>/g)!)
          assert.ok(tag.includes(`nonce="${nonce}"`) || /type="(rivet\/boundaries|application\/(ld\+)?json)"/.test(tag), tag);
      }
      assert.notEqual(fill.nonce, hit.nonce);
      const unnonced = (html: string) => html.replace(/ nonce="[^"]*"/g, ' nonce=""');
      assert.equal(unnonced(hit.html), unnonced(fill.html));
      assert.ok(
        warned.some((line) => line.includes("<Title> rendered after the shell")),
        warned.join("\n"),
      );
    } finally {
      console.warn = warn;
    }

    const first = await fetch(app.url + "/");
    const html = await first.text();
    const nonce = /'nonce-([^']+)'/.exec(first.headers.get("content-security-policy") ?? "")![1]!;
    const head = /<head>([\s\S]*)<\/head>/.exec(html)![1]!;
    assert.match(head, /<title>Home \| Kit<\/title>/, head);
    const order = ["<title>", /<link rel="stylesheet"|<style nonce/, "rivet-scripts", 'name="description"', 'rel="icon"', "ld+json"].map((s) =>
      typeof s === "string" ? head.indexOf(s) : head.search(s),
    );
    assert.ok(
      order.every((at) => at >= 0),
      head,
    );
    assert.deepEqual(
      [...order].sort((a, b) => a - b),
      order,
      head,
    );
    // The page's css`` sheet is written for this route only: linked, or inline with the nonce when small
    // (`rivetRouter({ inlineStylesheets })` default "auto").
    const sheetsOf = (text: string) =>
      [...text.matchAll(/<link rel="stylesheet" href="([^"]+)">|<style nonce="([^"]+)">([^<]*)<\/style>/g)].map((m) =>
        m[1] !== undefined ? { href: m[1] } : { nonce: m[2]!, css: m[3]! },
      );
    const homeCSS = sheetsOf(head);
    assert.ok(homeCSS.length >= 1, head);
    assert.ok(
      homeCSS.some((sheet) => sheet.nonce === nonce && sheet.css),
      "the small home sheet is inline, nonce'd: " + head,
    );
    assert.match(head, /"name":"Kit \\u003c\/script>"/);
    for (const tag of html.match(/<script\b[^>]*>/g)!)
      assert.ok(tag.includes(`nonce="${nonce}"`) || /type="(rivet\/boundaries|application\/(ld\+)?json)"/.test(tag), tag);
    const aboutHTML = await (await fetch(app.url + "/about")).text();
    const aboutCSS = sheetsOf(/<head>([\s\S]*)<\/head>/.exec(aboutHTML)![1]!).map(({ href, css }) => ({ href, css }));
    assert.notDeepEqual(
      aboutCSS,
      homeCSS.map(({ href, css }) => ({ href, css })),
    );
    // `?font`: preload from the head, @font-face in the route's stylesheet.
    const font = /<link rel="preload" href="(\/assets\/Probe-Regular-[^"]+\.woff2)" type="font\/woff2" as="font" crossorigin="anonymous" data-rh="">/.exec(
      aboutHTML,
    );
    assert.ok(font, aboutHTML);
    const sheets = await Promise.all(aboutCSS.map(async ({ href, css }) => css ?? (await fetch(app.url + href)).text()));
    assert.ok(
      sheets.some((sheet) => /font-family:"?Probe"?;/.test(sheet) && sheet.includes(font[1]!) && /font-weight:100 900/.test(sheet)),
      sheets.join("\n"),
    );

    const page = await browser.newPage();
    const errors: string[] = [],
      documents: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => message.text().startsWith("CSP ") && errors.push(message.text()));
    await page.addInitScript(() =>
      document.addEventListener("securitypolicyviolation", (event) => console.error("CSP " + event.violatedDirective + " " + event.blockedURI)),
    );
    await page.route(app.url + "/**", async (route) => {
      if (route.request().resourceType() !== "document") return route.continue();
      const response = await route.fetch();
      const policy = /'nonce-([^']+)'/.exec(response.headers()["content-security-policy"] ?? "");
      const headers = { ...response.headers(), ...(policy ? { "content-security-policy": strictCSP(policy[1]!, { trustedTypes: ["rivet-script"] }) } : {}) };
      await route.fulfill({ response, headers });
    });
    page.on("request", (request) => request.resourceType() === "document" && documents.push(new URL(request.url()).pathname));
    await page.goto(app.url + "/");
    await page.waitForFunction(() => (window as unknown as { lateLoaded?: number }).lateLoaded === 1);
    // One `rivet-script` policy per page (no 'allow-duplicates'): the bootstrap's, shared with the head manager.
    assert.equal(await page.evaluate(() => typeof (document as unknown as { $rs?: { p: unknown } }).$rs?.p), "object");
    assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById("home")!).color), "rgb(1, 2, 3)");
    await page.getByRole("button", { name: "Clicks 0" }).click();
    await page.getByRole("button", { name: "Clicks 1" }).waitFor();
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("button")!).outlineColor), "rgb(7, 8, 9)");
    // Navigation is client-side: a link click before the router's boundary adopted is held and replayed.
    await page.getByRole("link", { name: "About" }).click();
    await page.waitForSelector("#about");
    await page.waitForFunction(() => document.title === "About | Kit");
    const state = await page.evaluate(() => ({
      description:
        document.querySelectorAll('meta[name="description"]').length + ":" + document.querySelector('meta[name="description"]')?.getAttribute("content"),
      theme: document.querySelectorAll('meta[name="theme-color"]').length,
      icon: document.querySelectorAll('link[rel="icon"]').length,
      jsonLd: document.querySelectorAll('script[type="application/ld+json"]').length,
      color: getComputedStyle(document.getElementById("about")!).color,
    }));
    assert.deepEqual(state, { description: "1:About page", theme: 1, icon: 1, jsonLd: 0, color: "rgb(4, 5, 6)" });

    await page.getByRole("link", { name: "Home" }).click();
    await page.waitForSelector("#home");
    await page.waitForFunction(() => document.title === "Home | Kit");
    assert.equal(await page.evaluate(() => document.querySelector('meta[name="description"]')?.getAttribute("content")), "Home page");
    assert.equal(await page.evaluate(() => document.querySelectorAll('script[type="application/ld+json"]').length), 1);
    assert.deepEqual(documents, ["/"]);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await app.close();
  }
});
