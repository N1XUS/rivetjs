// An app component module outside `src/routes` that a route imports resumes without being listed in
// `resume.modules` (router default `resume.appModules`); `appModules: false` restores the explicit list.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { build, createServer } from "vite";
import { rivetRouter } from "../build/vite.ts";
import { start } from "../adapters/node.ts";
import { nodeEnv, withNodeEnv } from "./vite-env.ts";

const root = new URL("./fixture-resume-app/", import.meta.url).pathname;
const configFile = root + "vite.config.ts";
const COUNTER = "src/components/counter.tsx#Counter";
const has = (list: string[]) => list.includes(COUNTER);

const symbols = async (): Promise<string[]> => {
  const manifest = JSON.parse(await readFile(root + "dist/client/.vite/rivet-resume.json", "utf8")) as { symbols: Record<string, unknown> };
  return Object.keys(manifest.symbols);
};

test("production build: an unlisted app component module imported by a route resumes", async () => {
  await rm(root + "dist", { recursive: true, force: true });
  await withNodeEnv("production", () => build({ root, configFile, logLevel: "silent" }));
  await withNodeEnv("production", () => build({ root, configFile, logLevel: "silent", build: { ssr: true } }));
  assert.ok(has(await symbols()), "Counter is a boundary of the manifest (its module chunk)");
  const app = await start({ dist: root + "dist", port: 0, onError: () => {} });
  try {
    const res = await fetch(app.url + "/");
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html.replace(/<!--.*?-->/g, ""), /<button id="counter"[^>]*>Count 0<\/button>/);
    assert.ok(!html.includes('document.dispatchEvent(new CustomEvent("rivet:resume-error"'), "no render-failure script");
    assert.ok(html.includes(COUNTER), "the boundaries tail names the Counter boundary");
  } finally {
    await app.close();
  }
}, 120_000);

test("appModules: false keeps the explicit list (the unlisted module is not a resume module)", async () => {
  await rm(root + "dist", { recursive: true, force: true });
  const plugins = () => [rivetRouter({ resume: { modules: [], appModules: false } })];
  await withNodeEnv("production", () => build({ root, configFile: false, plugins: plugins(), logLevel: "silent" }));
  assert.ok(!has(await symbols()));
}, 120_000);

test("dev server: the unlisted module's page renders and resumes", async () => {
  const restoreEnv = nodeEnv("development");
  const server = await createServer({ root, configFile, logLevel: "silent", server: { port: 0 } });
  try {
    await server.listen();
    const html = await (await fetch(server.resolvedUrls!.local[0]!)).text();
    assert.ok(!html.includes('document.dispatchEvent(new CustomEvent("rivet:resume-error"'), "no render-failure script");
    assert.ok(html.includes("counter.tsx#Counter"), "the boundaries tail names the Counter boundary");
  } finally {
    await server.close();
    restoreEnv();
  }
}, 60_000);
