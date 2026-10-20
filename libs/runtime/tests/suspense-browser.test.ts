// Suspense on resumed, streamed pages (Chromium): the streamed Suspense segment swaps in as one unit and
// its handlers resume; a cut stream continues the Suspense in the browser (DOM Suspense, client loads).
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderResumable } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import type { IncomingMessage, ServerResponse } from "node:http";
import { compileResume, importServer, symbolChunks, symbolUrls } from "./resume/compile.ts";
import { withPage, rewrite, symbolModules } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

type ServerValue = ReturnType<Parameters<typeof renderResumable>[0]>;
const scope = globalThis as unknown as { __load?: (key: string) => Promise<string> };
const source = `
import { signal } from "@rivetjs/reactivity";
import { Async, Suspense } from "@rivetjs/runtime/server";
const loadData = (key: string) => ((globalThis as any).__load ? (globalThis as any).__load(key) : new Promise((r) => setTimeout(r, 30, "client " + key)));
export function Page() {
  const n = signal(0);
  return <main>
    <button id="top" onClick={() => n.set(n() + 1)}>{n()}</button>
    <section id="s"><Suspense fallback={() => <i id="wait">loading</i>}>{() => <>
      <Async load={() => loadData("a")}>{(v: string) => <button id="a" onClick={() => n.set(n() + 10)}>{v}:{n()}</button>}</Async>
      <Async load={() => loadData("b")}>{(v: string) => <b id="b">{v}</b>}</Async>
    </>}</Suspense></section>
  </main>;
}
`;
const dom = compileResume(source, "dom");
const server = await importServer<{ Page(): ServerValue }>(compileResume(source, "server").code);
const byComponent = symbolChunks(dom.symbols);
const files: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
};
Object.assign(files, symbolModules(byComponent));
const manifest: ResumeManifest = { hash: "t", runtime: "/rt.js", symbols: symbolUrls(dom.symbols) };

const gates = () => {
  const open: Record<string, () => void> = {}, promises: Record<string, Promise<string>> = {};
  for (const key of ["a", "b"]) promises[key] = new Promise<string>((resolve) => (open[key] = () => resolve(key)));
  scope.__load = (key) => promises[key]!;
  return open;
};
const streamed = (cut = false) => (_request: IncomingMessage, response: ServerResponse): void => {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.write("<!doctype html><html><head></head><body>");
  let ended = false;
  const write = (chunk: string): void => {
    if (ended) return;
    response.write(chunk);
    if (cut && chunk.includes("$rA=")) (ended = true), response.end("</body></html>");
  };
  (renderResumable(() => server.Page(), { write }, { manifest, stream: {} }) as Promise<void>).then(() => ended || response.end("</body></html>"));
};

test("a streamed Suspense swaps both parts in together; their handlers resume", async () => {
  const open = gates();
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/s", { waitUntil: "commit" });
    await page.waitForSelector("#wait");
    open.a!();
    await page.waitForTimeout(50);
    assert.equal(await page.$("#a"), null, "a alone is not revealed");
    open.b!();
    await page.waitForSelector("#a");
    assert.equal(await page.textContent("#s"), "a:0b");
    await page.click("#a");
    await page.waitForFunction(() => document.querySelector("#top")!.textContent === "10" && document.querySelector("#a")!.textContent === "a:10");
    assert.deepEqual(errors, []);
  }, { streams: { "/s": streamed() } });
  scope.__load = undefined;
});

test("a cut stream continues the Suspense in the browser: fallback, then both client loads together", async () => {
  const open = gates();
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/s");
    await page.waitForFunction(() => document.querySelector("#s")!.textContent === "client a:0client b");
    assert.deepEqual(errors, []);
  }, { streams: { "/s": streamed(true) } });
  // Let the abandoned server render finish.
  open.a!();
  open.b!();
  scope.__load = undefined;
});
