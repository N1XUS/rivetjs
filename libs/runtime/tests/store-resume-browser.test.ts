// Stores (R-4) on resumed pages: the store serializes as plain nodes of signals; resumed handlers
// write paths and only the bindings reading them update.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import { compileResume, importServer, symbolChunks, symbolUrls } from "./resume/compile.ts";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { DEV_BUILD, withPage, rewrite, symbolModules } from "./resume/harness.ts";
import { readable } from "./resume/wire.ts";
import type { Served } from "./resume/harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
const source = await readFile(new URL("./resume/store-fixture.tsx", import.meta.url), "utf8");
const dom = compileResume(source, "dom", "src/store.tsx");
const serverCode = compileResume(source, "server", "src/store.tsx").code;
const server = await importServer<{ Todos(): ServerValue }>(serverCode);
const DEV_RUN = process.execArgv.includes("--conditions=development");
const byComponent = symbolChunks(dom.symbols);
const files: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume();',
};
Object.assign(files, symbolModules(byComponent));
const manifest: ResumeManifest = { hash: "test", runtime: "/rt.js", symbols: symbolUrls(dom.symbols) };
const body = (await resumableToString(() => server.Todos(), { manifest })) as string;
files["/todos"] = "<!doctype html><html><head></head><body>" + body + "</body></html>";

test("server: the state holds the store data once and one node per read path", () => {
  const state = JSON.parse(/<script type="rivet\/state"[^>]*>(.*?)<\/script>/s.exec(body)![1]!) as { t: unknown[] };
  // Store nodes: { v: signal } (+ c: children).
  const nodes = state.t.filter((entry) => (entry as { o?: unknown[] } | null)?.o?.[0] === "v");
  // user, user.name, todos, todos.1, todos.1.done — not todos.0 nor user.email; the root is the narrowed `store` entry
  // (T12 / T13: `{k:"store", a:[root signal, nodes]}`).
  assert.equal(nodes.length, 5);
  const decoded = readable(state) as { t: unknown[] };
  assert.equal(decoded.t.filter((entry) => (entry as { k?: string } | null)?.k === "store").length, 1);
  assert.equal(JSON.stringify(state.t).split("ada@example.com").length, 2, "data is shared, not duplicated per path");
});

test("resumed handlers write store paths; only the bindings reading them update", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/todos");
    assert.equal(await page.textContent("#name"), "Ada");
    assert.equal(await page.textContent("#done"), "yes");
    await page.click("#rename");
    await page.waitForFunction(() => document.querySelector("#name")!.textContent === "Ada!");
    // The other binding's text node is the server one (never re-created).
    const marked = await page.evaluate(() => ((document.querySelector("#done")!.firstChild as Text & { mark?: 1 }).mark = 1));
    assert.equal(marked, 1);
    await page.click("#email");
    await page.click("#rename");
    await page.waitForFunction(() => document.querySelector("#name")!.textContent === "Ada!!");
    assert.equal(await page.evaluate(() => (document.querySelector("#done")!.firstChild as Text & { mark?: 1 }).mark), 1);
    await page.click("#toggle");
    await page.waitForFunction(() => document.querySelector("#done")!.textContent === "no");
    await page.click("#toggle");
    await page.waitForFunction(() => document.querySelector("#done")!.textContent === "yes");
    assert.deepEqual(errors, []);
  });
});

// Function Bridge T13 (C11) + T12: the compiler marks the store with its literal paths; the state ships those plus the
// server-read paths (a browser-only literal path included), never the unread `blob`.
test("server: the compiler marks the store with its literal paths; unread data stays on the server", async () => {
  assert.match(
    serverCode.replace(/\s+/g, " "),
    /__rivetR_storePaths\(createStore\([^]*?\), \[ ?"todos\.1\.done", "user\.bio", "user\.email", "user\.name" ?\]\)/,
  );
  assert.doesNotMatch(body, /UNSHIPPED_BLOB/);
  assert.match(body, /LONGBIO/);
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/todos");
    await page.click("#bio");
    await page.waitForFunction(() => document.querySelector("#bio")!.textContent === "LONGBIO");
    assert.deepEqual(errors, []);
  });
});

// T12 review L1: the real dom-resume `store` branch + the dev warning, through `createResume` (development builds of
// `#dev` and the store façade). A compiler miss is simulated by dropping `user.bio` from the server's paths.
test.runIf(DEV_RUN)("dev: a resumed read of an unshipped store path warns once, naming the path", async () => {
  const missed = serverCode.replace(/"user\.bio",\s*/, "");
  assert.notEqual(missed, serverCode);
  const dev = await importServer<{ Todos(): ServerValue }>(missed);
  const page$ = (await resumableToString(() => dev.Todos(), { manifest })) as string;
  assert.doesNotMatch(page$, /LONGBIO/);
  const source = async (path: string) => stripTypeScriptTypes(await readFile(new URL(path, import.meta.url), "utf8"));
  const development: Record<string, Served> = {
    ...files,
    "/todos": "<!doctype html><html><head></head><body>" + page$ + "</body></html>",
    ...DEV_BUILD,
    "/store.mjs": (await source("../../reactivity/store-dev.ts"))
      .replaceAll('"./store.ts"', '"/store-base.mjs"')
      .replaceAll('"./index.ts"', '"/reactivity.mjs"')
      .replaceAll('"./debug.ts"', '"/debug.mjs"'),
    "/store-base.mjs": (await source("../../reactivity/store.ts")).replaceAll('"./index.ts"', '"/reactivity.mjs"'),
    "/debug.mjs": (await source("../../reactivity/debug.ts")).replaceAll('"./index.ts"', '"/reactivity.mjs"'),
  };
  await withPage(development, async (page) => {
    const errors: string[] = [],
      warnings: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => void (message.type() === "warning" && warnings.push(message.text())));
    await page.goto("http://rivet.test/todos");
    await page.click("#bio");
    await page.waitForFunction(() => document.querySelector("#bio")!.textContent === "undefined");
    await page.click("#bio");
    await page.click("#rename");
    await page.waitForFunction(() => document.querySelector("#name")!.textContent === "Ada!");
    const store = warnings.filter((text) => text.includes("store path"));
    assert.equal(store.length, 1, warnings.join("\n"));
    assert.match(
      store[0]!,
      /^Rivet resume: store path "user\.bio" was not shipped .*\n {2}fix: .*\n {2}docs: https:\/\/rivetjs\.severyn\.pro\/guides\/state\/stores#in-a-resumed-page$/s,
    );
    assert.deepEqual(errors, []);
  });
});
