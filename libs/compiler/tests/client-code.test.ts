import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";
import { renderToString } from "@rivetjs/runtime/server";
import { withPage, rewrite } from "../../runtime/tests/resume/harness.ts";

const fixture = `
import { signal } from "@rivetjs/reactivity";
import { mount, clientEffect, clientEvent } from "@rivetjs/runtime/dom";
export function Widget({ log, size }) {
  let canvas;
  clientEffect(() => {
    log.push("effect:" + canvas.localName + ":" + size());
    return () => log.push("cleanup:" + size());
  });
  clientEvent(globalThis, "resize", () => log.push("resize"), { once: true });
  clientEvent("media:(min-width: 1px)", "change", () => log.push("media"));
  return <div><canvas ref={(el) => (canvas = el)} width={10} window:onKeyDown={(e) => log.push("key:" + e.key)} document:onClick={() => log.push("doc-click")} /></div>;
}
export async function run() {
  const log = [], size = signal(1);
  const host = document.createElement("div");
  document.body.append(host);
  const app = mount(() => <Widget log={log} size={size} />, host);
  await Promise.resolve();
  size.set(2);
  window.dispatchEvent(new Event("resize"));
  window.dispatchEvent(new Event("resize"));
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "k" }));
  document.dispatchEvent(new MouseEvent("click"));
  app();
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "x" }));
  document.dispatchEvent(new MouseEvent("click"));
  return log;
}
`;

test("server output drops ref and global event attributes", () => {
  const server = compile(`export const V = () => <canvas ref={(el) => el} window:onScroll={() => 1} width={3} />;`, { target: "server", filename: "v.tsx" });
  assert.deepEqual(server.diagnostics, []);
  // Arrow / function literals have nothing to evaluate on the server: no slot, one fragment (S6).
  assert.doesNotMatch(server.code, /omitted/);
  assert.match(server.code, /Object\.freeze\(\["<canvas", "><\/canvas>"\]\)/);
  // Other values are still evaluated (in source order) without markup.
  const named = compile(`export const V = (p: any) => <canvas ref={p.r} onClick={p.click} width={3} />;`, { target: "server", filename: "v.tsx" });
  assert.equal(named.code.match(/__rivetOmitted\(/g)?.length, 2, named.code);
  const bad = compile(`export const V = () => <div window:scroll={() => 1} />;`, { target: "server", filename: "v.tsx" });
  assert.match(bad.diagnostics[0].message, /Unsupported global event attribute: window:scroll/);
  const badDom = compile(`export const V = () => <div document:onclick={() => 1} />;`, { target: "dom", filename: "v.tsx" });
  assert.match(badDom.diagnostics[0].message, /Unsupported global event attribute/);
});

test("server render of ref and global events emits no markup", async () => {
  const server = compile(`export const V = () => <canvas ref={(el) => el} window:onScroll={() => 1} width={3} />;`, { target: "server", filename: "v.tsx" });
  const url =
    "data:text/javascript;base64," +
    Buffer.from(
      server.code
        .replaceAll("@rivetjs/runtime/server", new URL("../../runtime/server.ts", import.meta.url).href)
        .replaceAll("@rivetjs/runtime/slot", new URL("../../runtime/slot.ts", import.meta.url).href),
    ).toString("base64");
  const { V } = await import(url);
  assert.equal(await renderToString(V()), '<canvas width="3"></canvas>');
});

test("DOM ref, clientEffect, clientEvent and window:/document: events are owned", async () => {
  const dom = compile(fixture, { target: "dom", filename: "fixture.tsx" });
  assert.deepEqual(dom.diagnostics, []);
  await withPage({ "/": "<!doctype html><body></body>", "/fixture.mjs": rewrite(dom.code) }, async (page) => {
    await page.goto("http://rivet.test/");
    const log = await page.evaluate(async () => (await import("/fixture.mjs" as string)).run());
    assert.deepEqual(log, ["effect:canvas:1", "cleanup:2", "effect:canvas:2", "resize", "key:k", "doc-click", "cleanup:2"]);
  });
});
