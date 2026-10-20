import { readable } from "./resume/wire.ts";
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderResumable, resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import type { IncomingMessage, ServerResponse } from "node:http";
import { compileResume, importServer, symbolChunks, symbolUrls } from "./resume/compile.ts";
import { withPage, rewrite, symbolModules } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

/** What a resumable factory returns (as declared by server-resume). */
type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
type Entry = { k?: string; a?: number[]; s?: number } | number[] | string | number | boolean | null;
interface State {
  t: Entry[];
  e: Record<string, Record<string, [string, number[], number[]]>>;
  b: [number, string | null, string, number[], number[], number[], number, ...unknown[]][];
  a?: [number, number, number, number][];
}
interface Patch {
  id: number;
  t: Entry[];
  e: Record<string, unknown>;
  a: [number, number, number, number][];
}
const scope = globalThis as unknown as { __fail?: boolean; __load?: (key: string) => Promise<string> };

const source = `
import { signal } from "@rivetjs/reactivity";
import { Async, ErrorBoundary, Show } from "@rivetjs/runtime/server";
const failing = () => (globalThis as any).__fail;
const load = (key: string) => ((globalThis as any).__load ? (globalThis as any).__load(key) : Promise.resolve("client " + key));
const message = (error: unknown) => (error as Error).message;
function Boom() {
  if (failing()) throw new Error("boom <1>");
  return <b id="ok">ok</b>;
}
function Clicky({ id }: { id: string }) {
  const n = signal(0);
  return <button id={id} onClick={() => n.set(n() + 1)}>{n()}</button>;
}
export function Page() {
  const n = signal(0);
  return <main>
    <button id="top" onClick={() => n.set(n() + 1)}>{n()}</button>
    <ErrorBoundary fallback={(error, reset) => <p id="fb" onClick={reset}>{message(error)}</p>}>{() => <section><Clicky id="lost" /><Boom /></section>}</ErrorBoundary>
    <ErrorBoundary fallback={(error, reset) => <p id="fb2" onClick={reset}>{message(error)}</p>}>{() => <div>
      <Async load={() => load("first")}>{(v: string) => <button id="deferred" onClick={() => n.set(7)}>{v}</button>}</Async>
      <Async load={() => (failing() ? Promise.reject(new Error("later <2>")) : load("second"))}>{(v: string) => <i id="second">{v}</i>}</Async>
    </div>}</ErrorBoundary>
    <footer id="after">after</footer>
  </main>;
}
function Flaky({ id }: { id: string }) {
  if (failing()) throw new Error("flaky " + id);
  return <b id={id}>ok {id}</b>;
}
export function Mixed() {
  const on = signal(true);
  return <main>
    <button id="toggle" onClick={() => on.set(!on())}>t</button>
    <ErrorBoundary fallback={(error, reset) => <p id="mfb" onClick={reset}>{message(error)}</p>}>{() => <section>
      <Show when={() => on()} fallback={() => <i id="off1">off1</i>}>{() => <Flaky id="ok1" />}</Show>
    </section>}</ErrorBoundary>
    <Show when={() => on()} fallback={() => <i id="off2">off2</i>}>{() =>
      <ErrorBoundary fallback={(error, reset) => <p id="bfb" onClick={reset}>{message(error)}</p>}>{() => <Flaky id="ok2" />}</ErrorBoundary>}</Show>
  </main>;
}
export function Streamed() {
  return <main>
    <ErrorBoundary fallback={(error, reset) => <p id="sfb" onClick={reset}>{message(error)}</p>}>{() => <section id="content">
      <h2>content</h2>
      <Async load={() => load("a")} fallback={() => <i>wait a</i>}>{(v: string) => <em id="a">{v}</em>}</Async>
      <Async load={() => load("b")} fallback={() => <i>wait b</i>}>{(v: string) => <em id="b">{v}</em>}</Async>
    </section>}</ErrorBoundary>
    <aside><Async load={() => load("c")} fallback={() => <i>wait c</i>}>{(v: string) => <em id="c">{v}</em>}</Async></aside>
  </main>;
}
`;
const dom = compileResume(source, "dom");
const server = await importServer<{ Page(): ServerValue; Mixed(): ServerValue; Streamed(): ServerValue }>(compileResume(source, "server").code);
const byComponent = symbolChunks(dom.symbols);
const files: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
};
Object.assign(files, symbolModules(byComponent));
const manifest: ResumeManifest = { hash: "t", runtime: "/rt.js", symbols: symbolUrls(dom.symbols) };
const stateOf = (html: string): State => readable(JSON.parse(/<script type="rivet\/state" data-region="0"[^>]*>(.*?)<\/script>/s.exec(html)![1]!));
const patches = (html: string): Patch[] =>
  [...html.matchAll(/<script type="rivet\/state" data-patch="(\d+)">(.*?)<\/script>/gs)].map(([, id, json]) => ({ id: Number(id), ...(JSON.parse(json!) as Omit<Patch, "id">) }));
const failedPage = async (): Promise<string> => {
  scope.__fail = true;
  try {
    return await resumableToString(() => server.Page(), { manifest });
  } finally {
    scope.__fail = undefined;
  }
};

test("resume: failed boundaries render the fallback as a region; failed content records are dropped", async () => {
  const html = await failedPage();
  const state = stateOf(html);
  assert.match(html, /<!--r(\d+)\[--><p id="fb" data-r="\d+">boom &lt;1&gt;<\/p><!--\]-->/);
  assert.match(html, /<!--r(\d+)\[--><p id="fb2" data-r="\d+">later &lt;2&gt;<\/p><!--\]--><footer id="after">after<\/footer>/);
  assert.doesNotMatch(html, /lost|deferred|first/);
  // Handlers: #top and the two fallbacks only (the lost button and the deferred one were dropped).
  const handlers = Object.values(state.e).map((entry) => entry.click![0]);
  assert.equal(handlers.length, 3);
  // Each fallback's reset is a resumable reference to its boundary region.
  const regions = state.b.filter((entry) => entry[1] === "#").map((entry) => entry[0]);
  assert.equal(regions.length, 2);
  const resets = Object.values(state.e).flatMap((entry) => entry.click![1].map((ref) => state.t[ref])).filter((entry) => (entry as { k?: string })?.k === "reset");
  assert.deepEqual(resets.map((entry) => state.t[(entry as { a: number[] }).a[0]!]).sort(), regions.sort());
  // No streaming: no link entries, no stream add-on.
  assert.equal(state.a, undefined);
  assert.doesNotMatch(html, /\$rA=/);
  // Without failures: plain content, still re-creatable regions; reset entries absent.
  const ok = await resumableToString(() => server.Page(), { manifest });
  assert.match(ok, /<b id="ok">ok<\/b>/);
  assert.match(ok, /<i id="second">client second<\/i>/);
  assert.equal(stateOf(ok).b.filter((entry) => entry[1] === "#").length, 2);
});

test("resume: reset re-creates a server fallback's boundary in the browser", async () => {
  files["/page"] = "<!doctype html><html><head></head><body>" + (await failedPage()) + "</body></html>";
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/page");
    await page.click("#fb");
    await page.waitForSelector("#ok");
    await page.click("#lost");
    await page.waitForFunction(() => document.querySelector("#lost")!.textContent === "1");
    // The other server fallback is untouched until its own reset.
    assert.equal(await page.$eval("#fb2", (node) => node.textContent), "later <2>");
    await page.click("#fb2");
    await page.waitForFunction(() => document.querySelector("#second")?.textContent === "client second" && document.querySelector("#deferred")?.textContent === "client first");
    await page.click("#deferred");
    await page.waitForFunction(() => document.querySelector("#top")!.textContent === "7");
    assert.deepEqual(errors, []);
  });
});

test("resume: Show inside an ErrorBoundary and an ErrorBoundary inside a Show branch", async () => {
  scope.__fail = true;
  let failed: string;
  try {
    failed = await resumableToString(() => server.Mixed(), { manifest });
  } finally {
    scope.__fail = undefined;
  }
  // Both boundaries fall back; the failed Show's records (inside the first boundary) are dropped.
  assert.match(failed, /<p id="mfb" data-r="\d+">flaky ok1<\/p>/);
  assert.match(failed, /<p id="bfb" data-r="\d+">flaky ok2<\/p>/);
  assert.doesNotMatch(failed, /off1|ok ok1/);
  const ok = await resumableToString(() => server.Mixed(), { manifest });
  assert.match(ok, /<b id="ok1">ok ok1<\/b>/);
  assert.match(ok, /<b id="ok2">ok ok2<\/b>/);
  files["/mixed-failed"] = "<!doctype html><html><head></head><body>" + failed + "</body></html>";
  files["/mixed"] = "<!doctype html><html><head></head><body>" + ok + "</body></html>";
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const both = (a: string, b: string) => page.waitForFunction(([x, y]) => !!document.querySelector("#" + x) && !!document.querySelector("#" + y), [a, b]);
    // Resumed without failures: the toggle drives both Shows (inside and around a boundary).
    await page.goto("http://rivet.test/mixed");
    await page.click("#toggle");
    await both("off1", "off2");
    await page.click("#toggle");
    await both("ok1", "ok2");
    // Server fallbacks: each reset re-creates its boundary; the Shows keep working afterwards.
    await page.goto("http://rivet.test/mixed-failed");
    await page.click("#bfb");
    await page.waitForSelector("#ok2");
    await page.click("#mfb");
    await both("ok1", "ok2");
    await page.click("#toggle");
    await both("off1", "off2");
    assert.equal(await page.$("#ok1"), null);
    await page.click("#toggle");
    await both("ok1", "ok2");
    assert.deepEqual(errors, []);
  });
});

// Streaming: a failed segment inside a boundary writes the boundary's fallback as a segment.
const gates = (fail: string): Record<string, () => void> => {
  const open: Record<string, () => void> = {};
  const promises: Record<string, Promise<string>> = {};
  for (const key of ["a", "b", "c"])
    promises[key] = new Promise<string>((resolve, reject) => (open[key] = () => (key === fail ? reject(new Error("stream " + key + " <x>")) : resolve(key))));
  scope.__load = (key) => promises[key]!;
  return open;
};

test("stream: a failed segment inside a boundary becomes the boundary's fallback segment; its siblings are dropped", async () => {
  const open = gates("b");
  const chunks: string[] = [];
  const done = renderResumable(() => server.Streamed(), { write: (chunk) => void chunks.push(chunk) }, { manifest, stream: {} });
  await new Promise((resolve) => setTimeout(resolve, 5));
  open.b!();
  await new Promise((resolve) => setTimeout(resolve, 5));
  open.a!();
  open.c!();
  await done;
  scope.__load = undefined;
  const html = chunks.join("");
  const state = stateOf(html);
  // Shell: the boundary content (with both pending Asyncs) inside the boundary region; one link entry.
  const region = state.b.find((entry) => entry[1] === "#" && html.includes("<!--r" + entry[0] + "[--><section"))![0];
  const link = state.a!.find((entry) => entry[3] === 3)!;
  assert.deepEqual([link[0], link[2]], [region, region]);
  assert.match(html, /data-stream="\d+,\d+,\d+ \d+,\d+,\d+ \d+,\d+,\d+"/, "only pending Asyncs are listed");
  const list = patches(html);
  // b fails → the boundary's fallback replaces its content; a (inside) is dropped; c (outside) streams.
  assert.equal(list.length, 2);
  const [fallback, c] = list as [Patch, Patch];
  assert.equal(fallback.id, region);
  assert.deepEqual(fallback.a[0], [region, link[1], region, 1]);
  assert.equal(fallback.a.length, 3, "both inner boundaries retired");
  assert.ok(fallback.a.slice(1).every((entry) => entry[3] === 1));
  assert.match(html, new RegExp('<template data-a="' + region + '"><p id="sfb" data-r="\\d+">stream b &lt;x&gt;</p></template>'));
  assert.ok(Object.keys(fallback.e).length === 1, "the fallback's reset handler is in its patch");
  assert.doesNotMatch(html, /id="a"/);
  assert.match(html, /<em id="c">c<\/em>/);
  assert.equal(c.a[0]![3], 1);
});

const streamed = (fail: string) => (_request: IncomingMessage, response: ServerResponse): void => {
  const open = gates(fail);
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.write("<!doctype html><html><head></head><body>");
  (renderResumable(() => server.Streamed(), { write: (chunk) => void response.write(chunk) }, { manifest, stream: {} }) as Promise<void>).then(() => {
    scope.__load = undefined;
    response.end("</body></html>");
  });
  setTimeout(() => open.b!(), 20);
  setTimeout(() => (open.a!(), open.c!()), 40);
};

test("stream: the fallback segment swaps in; reset re-creates the boundary in the browser", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/stream");
    await page.waitForSelector("#sfb");
    await page.waitForSelector("#c");
    assert.equal(await page.$("#content"), null);
    assert.equal(await page.$eval("#sfb", (node) => node.textContent), "stream b <x>");
    await page.click("#sfb");
    await page.waitForFunction(() => document.querySelector("#a")?.textContent === "client a" && document.querySelector("#b")?.textContent === "client b");
    assert.deepEqual(errors, []);
  }, { streams: { "/stream": streamed("b") } });
});
