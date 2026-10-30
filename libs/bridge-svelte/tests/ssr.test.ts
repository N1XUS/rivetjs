import { afterEach, test } from "vitest";
import assert from "node:assert/strict";
import { adapter } from "../server.ts";
import type { IslandContext, IslandRender, SlotMark } from "@rivetjs/bridge/adapter";
import { counterHtml, slotsHtml, rawHeadHtml, asyncBodyHtml } from "./fixtures/html.ts";
import { fixture } from "./fixtures/compile.ts";

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});
const component = async (name: string, async = false) => {
  const compiled = await fixture(name, async);
  cleanups.push(compiled.cleanup);
  return compiled.component;
};
const mark = (name: string): SlotMark => ({
  name,
  html: "<rivet-slot" + (name === "default" ? "" : ` name="${name}"`) + ' style="display:contents"></rivet-slot>',
});
const context = (id = "i0"): IslandContext => ({ id, nonce: undefined, signal: new AbortController().signal, slot: mark });
const body = (result: string | IslandRender) => (typeof result === "string" ? result : result.html);

test("native SSR is synchronous, escapes props and prefixes $props.id per island", async () => {
  const counter = await component("Counter");
  const first = adapter.render(counter, { count: 2, label: "<script>" }, {}, context("i3"));
  assert.equal(typeof (first as PromiseLike<unknown>).then, "undefined");
  assert.match(body(first as string | IslandRender), /&lt;script>/);
  assert.match(body(first as string | IslandRender), /id="i3-/);
  const second = await adapter.render(counter, { count: 3 }, {}, context("i4"));
  assert.match(body(second), /id="i4-/);
});

test("default/named snippets preserve exact core holes, including legacy slot syntax", async () => {
  for (const name of ["Counter", "Legacy"]) {
    const html = body(await adapter.render(await component(name), {}, { default: mark("default"), title: mark("title") }, context()));
    for (const key of ["default", "title"]) assert.equal(html.split(mark(key).html).length, 2, name + ": " + html);
  }
});

test("svelte:head is forwarded as kit head fields separately from body", async () => {
  const result = await adapter.render(await component("Head"), {}, {}, context());
  assert.notEqual(typeof result, "string");
  const render = result as IslandRender;
  assert.equal(render.head?.title, "Svelte & Rivet");
  assert.deepEqual(render.head?.meta, [{ name: "description", content: "Svelte & Rivet" }]);
  assert.deepEqual(render.head?.links, [{ rel: "canonical", href: "https://example.com/" }]);
  assert.match(render.html, /<p>body<\/p>/);
  assert.doesNotMatch(render.html, /<title>|<meta|<link/);
  const native = Reflect.get(render.head!, Symbol.for("rivet.head.render")) as { render(): string };
  assert.equal(native.render(), "<!--rivet-head:svelte:i0-->" + rawHeadHtml + "<!--/rivet-head:svelte:i0-->");
  assert.deepEqual(JSON.parse(JSON.stringify(render.head)), {
    title: "Svelte & Rivet",
    meta: [{ name: "description", content: "Svelte & Rivet" }],
    links: [{ rel: "canonical", href: "https://example.com/" }],
  });
});

test("experimental async render awaits native thenable and propagates rejections", async () => {
  const async = await component("Async", true);
  assert.match(body(await adapter.render(async, { value: Promise.resolve("ready") }, {}, context())), /ready/);
  await assert.rejects(async () => adapter.render(async, { value: Promise.reject(new Error("async failed")) }, {}, context()), /async failed/);
});

test("component errors follow the bridge's island error path", async () => {
  const throws = await component("Throws");
  assert.throws(() => adapter.render(throws, {}, {}, context()), /Svelte render failure/);
});

test("browser hydration fixtures equal actual compiled server output", async () => {
  const counter = await component("Counter");
  assert.equal(body(await adapter.render(counter, { count: 1 }, {}, context())), counterHtml);
  assert.equal(body(await adapter.render(counter, { count: 1 }, { default: mark("default"), title: mark("title") }, context())), slotsHtml);
});

test("native head lifecycle forwards the CSP nonce on the synchronous render path", async () => {
  const result = adapter.render(await component("Metadata"), { label: "sync" }, {}, { ...context(), nonce: "svelte-sync-123" });
  assert.equal(typeof (result as PromiseLike<unknown>).then, "undefined");
  const rendering = Reflect.get((result as IslandRender).head!, Symbol.for("rivet.head.render")) as { boot(): string };
  assert.equal(/<script\b[^>]*\bnonce="svelte-sync-123"/.test(rendering.boot()), true);
});

test("native head lifecycle forwards the CSP nonce on the asynchronous render path", async () => {
  const result = adapter.render(await component("AsyncHead", true), { value: Promise.resolve("async") }, {}, { ...context(), nonce: "svelte-async-456" });
  assert.equal(typeof (result as PromiseLike<unknown>).then, "function");
  const rendering = Reflect.get(((await result) as IslandRender).head!, Symbol.for("rivet.head.render")) as { boot(): string };
  assert.equal(/<script\b[^>]*\bnonce="svelte-async-456"/.test(rendering.boot()), true);
});

test("async body hydration fixture retains native experimental async SSR branch markers", async () => {
  const async = await component("AsyncBody", true);
  const html = body(await adapter.render(async, { wait: () => Promise.resolve(true) }, {}, context()));
  assert.equal(html, asyncBodyHtml);
  assert.match(html, /<!--\[0-->/);
});
