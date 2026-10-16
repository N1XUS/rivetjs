import { test } from "vitest";
import assert from "node:assert/strict";
import { compiledTemplate, renderToWriter, Provider } from "../server.ts";
import { createContext, useContext, onCleanup, getOwner } from "@rivetjs/reactivity";

/** Renders here are asynchronous, so the `string | Promise` / `void | Promise` results are promises. */
const rejects = (value: unknown, error: Parameters<typeof assert.rejects>[1]): Promise<void> =>
  assert.rejects(value as Promise<unknown>, error);

test("compiler regions freeze trusted fragments; records are immutable by contract, not per-call freezes", () => {
  const fragments = ["a", "c"], slots = ["b"];
  const value = compiledTemplate(fragments, slots);
  assert.ok(Object.isFrozen(fragments));
  assert.throws(() => { fragments[0] = "<script>"; }, TypeError);
  assert.equal(value.fragments, fragments);
  assert.equal(value.slots, slots);
  assert.throws(() => compiledTemplate([], []), /one more fragment/);
});

test("compiled continuations restore owner for child work and every writer callback", async () => {
  const theme = createContext("default");
  let release: (() => void) | undefined, cleaned = 0;
  const seen: string[] = [], chunks: string[] = [];
  const scope = Provider({ token: theme, value: "scoped", children() {
    onCleanup(() => cleaned++);
    return compiledTemplate(["<div>", "", "</div>"], ["a", () => {
      seen.push("child:" + useContext(theme));
      return Promise.resolve("b");
    }]);
  } });
  const rendering = renderToWriter(scope, { write(chunk: string) {
    chunks.push(chunk);
    seen.push("write:" + useContext(theme));
    if (chunks.length === 1) return new Promise<void>(resolve => { release = resolve; });
  } });
  assert.deepEqual(chunks, ["<div>a"]);
  assert.deepEqual(seen, ["write:scoped"]);
  assert.equal(getOwner(), null);
  release!();
  await rendering;
  assert.equal(chunks.join(""), "<div>ab</div>");
  assert.ok(seen.every(value => value.endsWith(":scoped")));
  assert.equal(cleaned, 1);
  assert.equal(useContext(theme), "default");
});

test("abort during compiled flush disposes setup without invoking the next child", async () => {
  const controller = new AbortController();
  let cleaned = 0, invoked = 0;
  const rendering = renderToWriter(() => {
    onCleanup(() => cleaned++);
    return compiledTemplate(["prefix", "suffix"], [() => { invoked++; return "child"; }]);
  }, { write() { return new Promise(() => {}); } }, { signal: controller.signal });
  controller.abort(new Error("cancel compiled"));
  await rejects(rendering, /cancel compiled/);
  assert.equal(cleaned, 1);
  assert.equal(invoked, 0);
});

test("large scalar regions flush between bounded groups and honor backpressure", async () => {
  const fields = Array.from({ length: 100 }, () => "<&".repeat(500));
  const fragments = Array.from({ length: 101 }, () => "");
  fragments[0] = "<div>"; fragments[100] = "</div>";
  const chunks: string[] = [];
  let release: (() => void) | undefined;
  const rendering = renderToWriter(compiledTemplate(fragments, fields), { write(chunk: string) {
    chunks.push(chunk);
    if (chunks.length === 1) return new Promise<void>(resolve => { release = resolve; });
  } });
  assert.equal(chunks.length, 1);
  release!();
  await rendering;
  assert.equal(chunks.join(""), "<div>" + "&lt;&amp;".repeat(50000) + "</div>");
  assert.ok(chunks.length > 1 && chunks.length < 100);
  assert.ok(chunks.every(chunk => chunk.length <= 16 * 1024 + 4500));
});

test("compiled prefix acknowledgment precedes attribute coercion and failures preserve cleanup", async () => {
  const { attribute } = await import("../server.ts");
  let release: (() => void) | undefined, coerced = 0, cleaned = 0;
  const chunks: string[] = [];
  const rendering = renderToWriter(() => {
    onCleanup(() => cleaned++);
    return compiledTemplate(["<a", ">go</a>"], [attribute("href", {
      toString() { coerced++; throw new TypeError("coercion failed"); },
    })]);
  }, { write(chunk: string) {
    chunks.push(chunk);
    return new Promise<void>(resolve => { release = resolve; });
  } });
  assert.deepEqual(chunks, ["<a"]);
  assert.equal(coerced, 0);
  release!();
  await rejects(rendering, /coercion failed/);
  assert.equal(coerced, 1);
  assert.equal(cleaned, 1);
  assert.deepEqual(chunks, ["<a"]);
});
