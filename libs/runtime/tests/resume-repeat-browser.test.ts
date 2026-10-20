// Repeated entries in a real page (lane RESUME-STATE-DIET): a collection's handler maps / bindings written as repeats
// (`RepeatedHandlers` / `RepeatedBinding`, decoded by the inline repeat add-on in the loader's parse) and its recipes /
// props objects as table relocations (`{R}`), in the shell and in a streamed patch (the add-on ships before the first
// patch that needs it; the stream add-on decodes the patch when merging). Cold and live clicks on early and late rows.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderResumable, resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import type { IncomingMessage, ServerResponse } from "node:http";
import { REPEAT } from "../resume-loader.min.ts";
import { compileResume, importServer, symbolChunks, symbolUrls } from "./resume/compile.ts";
import { withPage, rewrite, symbolModules } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

type ServerValue = ReturnType<Parameters<typeof renderResumable>[0]>;
const scope = globalThis as unknown as { __load?: () => Promise<string> };
const source = `
import { computed, signal } from "@rivetjs/reactivity";
import { Async } from "@rivetjs/runtime/server";
const loadData = () => ((globalThis as any).__load ? (globalThis as any).__load() : Promise.resolve("client"));
function Row(props: { prefix: string; n: number; total: { set(v: number): void } }) {
  const count = signal(props.n);
  const double = computed(() => count() * 2);
  const item = { label: props.prefix + props.n, count, double };
  return (
    <li>
      <button id={props.prefix + props.n} title={item.label + ":" + count()} onClick={() => (count.set(count() + 1), props.total.set(item.double()))}>
        {double()}
      </button>
    </li>
  );
}
function Rows(props: { prefix: string; count: number; total: { set(v: number): void } }) {
  return <ul>{Array.from({ length: props.count }, (_, i) => <Row prefix={props.prefix} n={i} total={props.total} />)}</ul>;
}
export function Page(props: { shell: number }) {
  const total = signal(0);
  return <main>
    <output id="total">{total()}</output>
    <Rows prefix="s" count={props.shell} total={total} />
    <section id="late"><Async load={() => loadData()} fallback={() => <i>wait</i>}>{(v: string) => <Rows prefix={v} count={50} total={total} />}</Async></section>
  </main>;
}
`;
const dom = compileResume(source, "dom");
const server = await importServer<{ Page(props: { shell: number }): ServerValue }>(compileResume(source, "server").code);
const byComponent = symbolChunks(dom.symbols);
const files: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
};
Object.assign(files, symbolModules(byComponent));
const manifest: ResumeManifest = { hash: "t", runtime: "/rt.js", symbols: symbolUrls(dom.symbols) };

let open!: () => void;
const streamed =
  (shell: number) =>
  (_request: IncomingMessage, response: ServerResponse): void => {
    scope.__load = () => new Promise<string>((resolve) => (open = () => resolve("p")));
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.write("<!doctype html><html><head></head><body>");
    (renderResumable(() => server.Page({ shell }), { write: (chunk: string) => void response.write(chunk) }, { manifest, stream: {} }) as Promise<void>).then(
      () => response.end("</body></html>"),
    );
  };

test("the page writes repeats: shell and patch", async () => {
  scope.__load = () => Promise.resolve("p");
  const html = await resumableToString(() => server.Page({ shell: 50 }), { manifest });
  const state = JSON.parse(/<script type="rivet\/state"[^>]*>(.*?)<\/script>/s.exec(html)![1]!) as { e: Record<string, unknown>; b: number[][]; t: unknown[] };
  assert.ok(html.indexOf(REPEAT) >= 0 && html.indexOf(REPEAT) < html.indexOf('type="rivet/state"'));
  assert.ok(Object.values(state.e).filter(Array.isArray).length >= 90);
  assert.ok(state.b.filter((entry) => entry[0]! < -1).length >= 90);
  const R = state.t.filter((entry) => entry !== null && typeof entry === "object" && "R" in entry).length;
  assert.ok(R >= 45, R + " " + JSON.stringify(state.t.slice(0, 60)));
  // Streamed: the patch of the late rows repeats too (the shell shipped the add-on).
  let out = "";
  await (renderResumable(() => server.Page({ shell: 50 }), { write: (chunk: string) => void (out += chunk) }, { manifest, stream: {} }) as Promise<void>);
  const patch = JSON.parse(/<script type="rivet\/state" data-patch="\d+">(.*?)<\/script>/s.exec(out)![1]!) as { e: Record<string, unknown>; b: number[][] };
  assert.ok(Object.values(patch.e).filter(Array.isArray).length >= 45);
  assert.ok(patch.b.filter((entry) => entry[0]! < -1).length >= 45);
  assert.equal(out.split(REPEAT).length, 2);
  // A one-row shell writes no repeats (the add-on would cost more): the add-on goes right before the patch that needs it.
  out = "";
  await (renderResumable(() => server.Page({ shell: 1 }), { write: (chunk: string) => void (out += chunk) }, { manifest, stream: {} }) as Promise<void>);
  const at = out.indexOf(REPEAT);
  assert.ok(at > out.indexOf('type="rivet/state" data-region="0"') && at < out.indexOf("data-patch="));
});

test("repeated rows resume: cold and live clicks on first / last rows, shell and streamed patch", async () => {
  await withPage(
    files,
    async (page) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("http://rivet.test/stream", { waitUntil: "commit" });
      await page.waitForSelector("#s49");
      // Cold click on the last shell row (a repeat of row 48): its own signal, computed and props object.
      await page.click("#s49");
      await page.waitForFunction(() => document.querySelector("#s49")!.textContent === "100" && document.querySelector("#total")!.textContent === "100");
      assert.equal(await page.$eval("#s49", (node) => node.getAttribute("title")), "s49:50");
      await page.click("#s0");
      await page.waitForFunction(() => document.querySelector("#s0")!.textContent === "2" && document.querySelector("#total")!.textContent === "2");
      // The streamed rows arrive after the runtime started: their patch carries repeats too.
      open();
      await page.waitForSelector("#p49");
      await page.click("#p37");
      await page.waitForFunction(() => document.querySelector("#p37")!.textContent === "76" && document.querySelector("#total")!.textContent === "76");
      assert.equal(await page.$eval("#p37", (node) => node.getAttribute("title")), "p37:38");
      await page.click("#s20");
      await page.waitForFunction(() => document.querySelector("#s20")!.textContent === "42");
      assert.deepEqual(errors, []);
    },
    { streams: { "/stream": streamed(50) } },
  );
});

test("the add-on first ships with a streamed patch: its rows resume", async () => {
  await withPage(
    files,
    async (page) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("http://rivet.test/stream", { waitUntil: "commit" });
      await page.waitForSelector("#s0");
      open();
      await page.waitForSelector("#p49");
      // Cold: the runtime starts with this click on a repeated row of the patch.
      await page.click("#p48");
      await page.waitForFunction(() => document.querySelector("#p48")!.textContent === "98" && document.querySelector("#total")!.textContent === "98");
      await page.click("#s0");
      await page.waitForFunction(() => document.querySelector("#total")!.textContent === "2");
      assert.deepEqual(errors, []);
    },
    { streams: { "/stream": streamed(1) } },
  );
});
