import { test } from "vitest";
import assert from "node:assert/strict";
import { renderResumable } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import type { Page } from "playwright";
import type { IncomingMessage, ServerResponse } from "node:http";
import { compileResume, compileSymbolModule, importServer } from "./resume/compile.ts";
import type { ResumeSymbol } from "./resume/compile.ts";
import { withPage, rewrite } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

/** What a resumable factory returns (as declared by server-resume). */
type ServerValue = ReturnType<Parameters<typeof renderResumable>[0]>;
interface Gate {
  promise: Promise<string>;
  open(): void;
}
const scope = globalThis as unknown as { __load?: (key: string) => Promise<string> };

const source = `
import { signal } from "@rivetjs/reactivity";
import { Async } from "@rivetjs/runtime/server";
const loadData = (key: string) => ((globalThis as any).__load ? (globalThis as any).__load(key) : Promise.resolve("client " + key));
function Panel({ k }: { k: number }) {
  return <Async load={() => loadData("c" + k)} fallback={() => <i>wait c</i>}>{(v: string) => <em id="cv">{v}</em>}</Async>;
}
export function Streamed() {
  const n = signal(0);
  const k = signal(0);
  return <main>
    <button id="top" onClick={() => n.set(n() + 1)}>{n()}</button>
    <button id="k" onClick={() => k.set(1)}>k</button>
    <section id="a"><Async load={() => loadData("a")} fallback={() => <i>wait a</i>}>{(v: string) =>
      <button id="inner" onClick={() => n.set(n() + 10)}>{v}:{n()}</button>}</Async></section>
    <section id="b"><Async load={() => loadData("b")} fallback={() => <i>wait b</i>}>{(v: string) => <b id="bv">{v}</b>}</Async></section>
    <section id="c"><Panel k={k()} /></section>
  </main>;
}
`;
const dom = compileResume(source, "dom");
const server = await importServer<{ Streamed(): ServerValue }>(compileResume(source, "server").code);
const byComponent: Record<string, ResumeSymbol[]> = {};
for (const symbol of dom.symbols) (byComponent["/c/" + symbol.component + ".js"] ??= []).push(symbol);
const files: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
};
for (const [path, symbols] of Object.entries(byComponent)) files[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));
const manifest: ResumeManifest = { hash: "t", runtime: "/rt.js", symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])) };

const gates = (): Record<string, Gate> => {
  const out: Record<string, Gate> = {};
  for (const key of ["a", "b", "c0"]) {
    let resolve!: (value: string) => void;
    const promise = new Promise<string>((r) => (resolve = r));
    out[key] = { promise, open: () => resolve(key) };
  }
  scope.__load = (key) => out[key]!.promise;
  return out;
};
// Shell, then segments as their loads settle; `cut` ends the response right after the shell.
const streamed = (cut = false) => (_request: IncomingMessage, response: ServerResponse): void => {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.write("<!doctype html><html><head></head><body>");
  let ended = false;
  const write = (chunk: string): void => {
    if (ended) return;
    response.write(chunk);
    if (cut && chunk.includes("$rA=")) (ended = true), response.end("</body></html>");
  };
  (renderResumable(() => server.Streamed(), { write }, { manifest, stream: {} }) as Promise<void>).then(() => ended || response.end("</body></html>"));
};
const text = (page: Page, selector: string): Promise<string | null> => page.$eval(selector, (node) => node.textContent);
const modules = (requests: string[]): string[] => requests.filter((path) => /\.(m?js)$/.test(path));

test("streamed content swaps in before and after the runtime starts; late patches see client state", async () => {
  const gate = gates();
  await withPage(files, async (page, requests) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/stream", { waitUntil: "commit" });
    await page.waitForSelector("#top");
    assert.equal(await text(page, "#a"), "wait a");
    gate.b!.open();
    await page.waitForSelector("#bv");
    assert.equal(await text(page, "#b"), "b");
    assert.deepEqual(modules(requests), []);
    // Runtime starts with the click; boundary a is still pending.
    await page.click("#top");
    await page.waitForFunction(() => document.querySelector("#top")!.textContent === "1");
    // a arrives after start: its text binding read n (revived, now 1), so it activates at once.
    gate.a!.open();
    await page.waitForFunction(() => document.querySelector("#inner")?.textContent === "a:1");
    await page.click("#inner");
    await page.waitForFunction(() => document.querySelector("#top")!.textContent === "11" && document.querySelector("#inner")!.textContent === "a:11");
    gate.c0!.open();
    await page.waitForSelector("#cv");
    assert.equal(await text(page, "#cv"), "c0");
    assert.deepEqual(errors, []);
  }, { streams: { "/stream": streamed() } });
});

test("a segment for a region the browser re-created is dropped", async () => {
  const gate = gates();
  gate.a!.open();
  gate.b!.open();
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/stream", { waitUntil: "commit" });
    await page.waitForSelector("#bv");
    assert.equal(await text(page, "#c"), "wait c");
    // k changes: the Panel region is re-created in the browser, its Async loads there.
    await page.click("#k");
    await page.waitForFunction(() => document.querySelector("#cv")?.textContent === "client c1");
    gate.c0!.open();
    await page.waitForFunction(() => !document.querySelector('template[data-a]') && !document.querySelector("script[data-patch]") && document.readyState === "complete");
    assert.equal(await text(page, "#c"), "client c1");
    assert.deepEqual(errors, []);
  }, { streams: { "/stream": streamed() } });
});

test("a cut stream continues pending boundaries in the browser", async () => {
  gates();
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/stream");
    await page.waitForFunction(
      () => document.querySelector("#inner")?.textContent === "client a:0" && document.querySelector("#bv")?.textContent === "client b" && document.querySelector("#cv")?.textContent === "client c0",
    );
    await page.click("#inner");
    await page.waitForFunction(() => document.querySelector("#top")!.textContent === "10");
    assert.deepEqual(errors, []);
  }, { streams: { "/stream": streamed(true) } });
});
