// Derived model, streamed holes (DERIVED-C2): an `Async` with a fallback whose load is pending writes `<!--a<id>-->…<!--/a-->`
// and a tail / patch entry (`a`: its unit, its place, then its value). Awaited in place (no stream), the content and its
// value are in the shell; streamed (`renderDerived` with `stream`), the fallback is, and the content follows as a segment
// (`<template data-a>` + patch + `$rD`). The browser's adopt run makes that `Async` a hole and adopts its content with the
// server's value — its `load` never runs — whether the segment landed before the runtime started or after the unit adopted.
// Compiled with the real derived server + DOM targets (skips on a wasm without the model).
import { test } from "vitest";
import assert from "node:assert/strict";
import { expandTail } from "@rivetjs/runtime/resume-format";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString, renderDerived } from "@rivetjs/runtime/server-derived";
import type { Page } from "playwright";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, rewrite, withPage } from "./resume/harness.ts";
// Tail v2 (ZERO S2) in its flush shape (names resolved, runs expanded), loosely typed like the JSON it was.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tailJson = (tail: unknown): any => expandTail(tail as never);

const compiled = hasDerivedModel() ? test : test.skip;
const PAGE = `import { signal } from "@rivetjs/reactivity";
import { Async } from "@rivetjs/runtime/dom";
export function Inner(props: { label: string }) {
  const n = signal(0);
  return <button id={"inner-" + props.label} onClick={() => n.set(n() + 1)}>{props.label + n()}</button>;
}
export function App(props: { data: PromiseLike<{ items: string[] }> }) {
  const count = signal(0);
  const picked = signal("none");
  return (
    <section>
      <button id="count" onClick={() => count.set(count() + 1)}>{count()}</button>
      <Async load={() => ((globalThis as { loads?: number }).loads = ((globalThis as { loads?: number }).loads ?? 0) + 1, props.data)} fallback={() => <p id="wait">wait</p>}>
        {(value) => (
          <div id="list">
            <ul>
              {value.items.map((item) => (
                <li>
                  <button onClick={() => picked.set(item)}>{item}</button>
                </li>
              ))}
            </ul>
            <Inner label="x" />
          </div>
        )}
      </Async>
      <p id="picked">{picked()}</p>
    </section>
  );
}
`;
const RESUME = { module: "src/page.tsx", boundaries: ["App", "Inner"], independent: ["App"] };
const manifest = { hash: "t", runtime: "/rt.js", symbols: { "src/page.tsx#App": "/page.js", "src/page.tsx#Inner": "/page.js" } };
const ITEMS = { items: ["Io", "Europa"] };

async function build(): Promise<{ App: (props: { data: PromiseLike<unknown> }) => ServerValue; dom: string }> {
  const server = compile(PAGE, { target: "server", filename: "page.tsx", resume: RESUME } as never);
  const dom = compile(PAGE, { target: "dom", filename: "page.tsx", resume: RESUME } as never);
  assert.deepEqual(server.diagnostics, []);
  assert.deepEqual(dom.diagnostics, []);
  const { App } = await importServer<{ App: (props: { data: PromiseLike<unknown> }) => ServerValue }>(server.code);
  return { App, dom: rewrite(dom.code) };
}
const files = (html: string, dom: string): Record<string, string> => ({
  ...DERIVED_BUILD,
  "/": "<!doctype html><html><body>" + html + "</body></html>",
  "/rt.js": 'export { default } from "/dom-derived.ts";',
  "/page.js": dom,
});
/** `renderDerived` with `stream` into chunks; `gate` holds the load until released. */
async function streamed(App: (props: { data: PromiseLike<unknown> }) => ServerValue, gate: Promise<void>, deadline?: number): Promise<string[]> {
  const chunks: string[] = [];
  const data = gate.then(() => ITEMS);
  await renderDerived(
    () => App({ data }),
    { write: (chunk: string) => void chunks.push(chunk) },
    { manifest, stream: deadline === undefined ? {} : { deadline } },
  );
  return chunks;
}
const tag = (page: Page, selectors: string[]): Promise<void> =>
  page.evaluate((list) => list.forEach((s, i) => ((document.querySelector(s) as unknown as Record<string, number>).__t = i + 1)), selectors);
const tagged = (page: Page, selectors: string[]): Promise<boolean[]> =>
  page.evaluate((list) => list.map((s, i) => (document.querySelector(s) as unknown as Record<string, number> | null)?.__t === i + 1), selectors);
const text = (page: Page, selector: string): Promise<string | null> => page.textContent(selector);

compiled("server: awaited in place — markers around the content, the value in the shell's tail", async () => {
  const { App } = await build();
  const html = (await derivedToString(() => App({ data: Promise.resolve(ITEMS) }), { manifest })) as string;
  assert.match(html, /<!--a1--><div id="list">.*<\/div><!--\/a-->/s);
  const tail = tailJson(JSON.parse(/<script type="rivet\/boundaries"[^>]*>(.*?)<\/script>/s.exec(html)![1]!));
  assert.deepEqual(tail.a, [[1, 1, 0, 1, ITEMS]]);
  assert.ok(!html.includes("$rD"), "no stream add-on without streaming");
});

compiled("server: streamed — fallback in the shell (entry pending), the content as a segment with its value and records", async () => {
  const { App } = await build();
  const chunks = await streamed(App, Promise.resolve());
  const html = chunks.join("");
  const shell = html.slice(0, html.indexOf("<template"));
  assert.match(shell, /<!--a1--><p id="wait">wait<\/p><!--\/a-->/);
  assert.deepEqual(tailJson(JSON.parse(/<script type="rivet\/boundaries" data-rt[^>]*>(.*?)<\/script>/s.exec(shell)![1]!)).a, [[1, 1, 0]]);
  assert.equal(html.match(/window\.\$rD=/g)?.length, 1, "the swap add-on once");
  const patch = tailJson(JSON.parse(/<script type="rivet\/boundaries" data-patch="1">(.*?)<\/script>/s.exec(html)![1]!));
  assert.deepEqual(patch.a, [[1, 1, 0, 1, ITEMS]]);
  // The content's boundary (Inner) is numbered on from the shell's.
  assert.deepEqual(
    patch.b.map((r: unknown[]) => r.slice(0, 4)),
    [[2, 1, 2, "src/page.tsx#Inner"]],
  );
  assert.match(
    html,
    /<template data-a="1"><div id="list">.*<\/template><script type="rivet\/boundaries" data-patch="1">.*<\/script><script>\$rD\(1\)<\/script>$/s,
  );
});

compiled("server: a stream cut by its deadline leaves the boundary to the browser (no template, entry without a value)", async () => {
  const { App } = await build();
  const chunks = await streamed(App, new Promise(() => {}), 10);
  const html = chunks.join("");
  assert.ok(!html.includes("<template"));
  assert.deepEqual(tailJson(JSON.parse(/data-patch="1">(.*?)<\/script>/s.exec(html)![1]!)).a, [[1, 1, 0, 0]]);
});

compiled("awaited in place: the content adopts with the server's value (its load never runs in the browser)", async () => {
  const { App, dom } = await build();
  const html = (await derivedToString(() => App({ data: Promise.resolve(ITEMS) }), { manifest })) as string;
  await withPage(files(html, dom), async (page) => {
    await page.goto("http://rivet.test/");
    await tag(page, ["#list", "li:nth-child(2) button", "#inner-x"]);
    await page.click("li:nth-child(2) button");
    await page.waitForFunction(() => document.querySelector("#picked")!.textContent === "Europa");
    assert.deepEqual(await tagged(page, ["#list", "li:nth-child(2) button", "#inner-x"]), [true, true, true], "server nodes kept");
    // The content's own boundary adopts too (a child of the content unit).
    await page.click("#inner-x");
    await page.waitForFunction(() => document.querySelector("#inner-x")!.textContent === "x1");
    await page.click("#count");
    assert.equal(await text(page, "#count"), "1");
    assert.equal(await page.evaluate(() => (globalThis as { loads?: number }).loads ?? 0), 0, "its load never ran in the browser");
  });
});

compiled("streamed, landed before the runtime started: the swapped-in content adopts", async () => {
  const { App, dom } = await build();
  const html = (await streamed(App, Promise.resolve())).join("");
  await withPage(files(html, dom), async (page) => {
    await page.goto("http://rivet.test/");
    assert.equal(await page.$("#wait"), null, "the segment replaced the fallback");
    await tag(page, ["#list", "li:nth-child(1) button"]);
    await page.click("li:nth-child(1) button");
    await page.waitForFunction(() => document.querySelector("#picked")!.textContent === "Io");
    assert.deepEqual(await tagged(page, ["#list", "li:nth-child(1) button"]), [true, true]);
  });
});

compiled("streamed, landing after the unit adopted over its fallback: the hole waits, then adopts the content", async () => {
  const { App, dom } = await build();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const data = gate.then(() => ITEMS);
  await withPage(
    files("", dom),
    async (page) => {
      await page.goto("http://rivet.test/", { waitUntil: "commit" });
      await page.waitForSelector("#wait");
      await page.click("#count");
      await page.waitForFunction(() => document.querySelector("#count")!.textContent === "1");
      // The unit adopted with the fallback showing; now the segment lands.
      release();
      await page.waitForSelector("#list");
      await tag(page, ["#list"]);
      await page.click("li:nth-child(2) button");
      await page.waitForFunction(() => document.querySelector("#picked")!.textContent === "Europa");
      assert.deepEqual(await tagged(page, ["#list"]), [true], "the segment's nodes adopted");
      await page.click("#count");
      assert.equal(await text(page, "#count"), "2");
      assert.equal(await page.evaluate(() => (globalThis as { loads?: number }).loads ?? 0), 0, "its load never ran in the browser");
    },
    {
      streams: {
        // The shell as it renders, the segment once the test releases the load.
        "/": (_request, response) => {
          response.writeHead(200, { "content-type": "text/html" });
          response.write("<!doctype html><html><body>");
          void Promise.resolve(renderDerived(() => App({ data }), { write: (chunk: string) => void response.write(chunk) }, { manifest, stream: {} })).then(
            () => response.end("</body></html>"),
          );
        },
      },
    },
  );
});

// DERIVED-C3: an `Async` in a component's children slot under a `Provider` (cdk story `/shell-provider`). The slot renders
// after the boundary's body returned, under the provider's owner: the server attributes it to the boundary whose body made
// that owner (as the browser's adopt run of that unit counts it), so it is a hole of that unit, not of the one above.
const PROVIDED = `import { signal, createContext, useContext, type Signal } from "@rivetjs/reactivity";
import { Async, Provider, type DOMValue } from "@rivetjs/runtime/dom";
const Board = createContext<{ picked: Signal<string> } | null>(null);
function Counted(props: { children: DOMValue }) {
  const picked = signal("none");
  return <Provider token={Board} value={{ picked }}>{props.children}</Provider>;
}
export function Shell(props: { children: DOMValue }) {
  return <main>{props.children}</main>;
}
export function App(props: { data: PromiseLike<{ items: string[] }> }) {
  const count = signal(0);
  return (
    <section>
      <button id="count" onClick={() => count.set(count() + 1)}>{count()}</button>
      <Counted>
        <Async load={() => ((globalThis as { loads?: number }).loads = ((globalThis as { loads?: number }).loads ?? 0) + 1, props.data)} fallback={() => <p id="wait">wait</p>}>
          {(value) => {
            const board = useContext(Board)!;
            return (
              <div id="list">
                <ul>
                  {value.items.map((item) => (
                    <li>
                      <button onClick={() => board.picked.set(item)}>{item}</button>
                    </li>
                  ))}
                </ul>
                <p id="picked">{board.picked()}</p>
              </div>
            );
          }}
        </Async>
      </Counted>
    </section>
  );
}
export function Page(props: { data: PromiseLike<{ items: string[] }> }) {
  const n = signal(0);
  return (
    <Shell>
      <button id="outer" onClick={() => n.set(n() + 1)}>{n()}</button>
      <App data={props.data} />
    </Shell>
  );
}
`;
const PROVIDED_RESUME = { module: "src/page.tsx", boundaries: ["Page", "App"], independent: ["Page"] };
const providedManifest = { hash: "t", runtime: "/rt.js", symbols: { "src/page.tsx#Page": "/page.js", "src/page.tsx#App": "/page.js" } };
async function buildProvided(): Promise<{ Page: (props: { data: PromiseLike<unknown> }) => ServerValue; dom: string }> {
  const server = compile(PROVIDED, { target: "server", filename: "page.tsx", resume: PROVIDED_RESUME } as never);
  const dom = compile(PROVIDED, { target: "dom", filename: "page.tsx", resume: PROVIDED_RESUME } as never);
  assert.deepEqual(server.diagnostics, []);
  assert.deepEqual(dom.diagnostics, []);
  const { Page } = await importServer<{ Page: (props: { data: PromiseLike<unknown> }) => ServerValue }>(server.code);
  return { Page, dom: rewrite(dom.code) };
}

compiled("server: an `Async` in a children slot under a provider is keyed by the boundary whose body made the provider", async () => {
  const { Page } = await buildProvided();
  const chunks: string[] = [];
  await renderDerived(
    () => Page({ data: Promise.resolve(ITEMS) }),
    { write: (chunk: string) => void chunks.push(chunk) },
    { manifest: providedManifest, stream: {} },
  );
  const html = chunks.join("");
  const tail = tailJson(JSON.parse(/<script type="rivet\/boundaries" data-rt[^>]*>(.*?)<\/script>/s.exec(html)![1]!));
  const app = tail.b.find((r: unknown[]) => r[3] === "src/page.tsx#App")[0];
  assert.deepEqual(tail.a, [[1, app, 0]], "keyed by App (its body made the provider), place 0");
  const patch = tailJson(JSON.parse(/data-patch="1">(.*?)<\/script>/s.exec(html)![1]!));
  assert.equal(patch.w, undefined, "the content's reads of App's keyed state are App's own (no wake list)");
});

compiled("streamed under a provider: the content adopts with the server's value (no browser load, provided state live)", async () => {
  const { Page, dom } = await buildProvided();
  const chunks: string[] = [];
  await renderDerived(
    () => Page({ data: Promise.resolve(ITEMS) }),
    { write: (chunk: string) => void chunks.push(chunk) },
    { manifest: providedManifest, stream: {} },
  );
  await withPage({ ...files(chunks.join(""), dom) }, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/");
    await tag(page, ["main", "#list", "li:nth-child(2) button"]);
    await page.click("li:nth-child(2) button");
    await page.waitForFunction(() => document.querySelector("#picked")!.textContent === "Europa");
    assert.deepEqual(await tagged(page, ["main", "#list", "li:nth-child(2) button"]), [true, true, true], "server nodes kept");
    await page.click("#count");
    assert.equal(await text(page, "#count"), "1");
    await page.click("#outer");
    assert.equal(await text(page, "#outer"), "1");
    assert.equal(await page.evaluate(() => (globalThis as { loads?: number }).loads ?? 0), 0, "its load never ran in the browser");
    assert.deepEqual(errors, []);
  });
});

// DERIVED-C3: a settled value that is not JSON data (a deferred loader's `Date`) ships as its resume table (tail / patch
// entry settled 2); the browser decodes it with the decoder the router's derived `Root` installs (`_useTableDecoder`) and
// adopts the content with it — its load never runs (before: settled 0, the content re-rendered in the browser with a
// load that read the route payload's `{}` deferred handle).
const DATED = { items: ["Io", "Europa"], at: new Date(0) };
async function streamedDated(App: (props: { data: PromiseLike<unknown> }) => ServerValue): Promise<string> {
  const chunks: string[] = [];
  await renderDerived(
    () => App({ data: Promise.resolve().then(() => DATED) }),
    { write: (chunk: string) => void chunks.push(chunk) },
    { manifest, stream: {} },
  );
  return chunks.join("");
}

compiled("server: a settled value that is not JSON data ships as its resume table (settled 2)", async () => {
  const { App } = await build();
  const html = await streamedDated(App);
  const [entry] = tailJson(JSON.parse(/<script type="rivet\/boundaries" data-patch="1">(.*?)<\/script>/s.exec(html)![1]!)).a;
  assert.deepEqual(entry.slice(0, 4), [1, 1, 0, 2]);
  const { createDecoder } = await import("@rivetjs/runtime/resume-format");
  assert.deepEqual(createDecoder(entry[4].t).get(entry[4].r), DATED);
});

compiled("streamed, table-encoded value: decoded with the installed table decoder, adopted, its load never runs", async () => {
  const { App, dom } = await build();
  const html = await streamedDated(App);
  const rt = 'import { _useTableDecoder } from "/resume-format.ts"; _useTableDecoder(); export { default } from "/dom-derived.ts";';
  await withPage({ ...files(html, dom), "/rt.js": rt }, async (page) => {
    await page.goto("http://rivet.test/");
    await tag(page, ["#list"]);
    await page.click("li:nth-child(2) button");
    await page.waitForFunction(() => document.querySelector("#picked")!.textContent === "Europa");
    assert.deepEqual(await tagged(page, ["#list"]), [true], "server nodes kept");
    assert.equal(await page.evaluate(() => (globalThis as { loads?: number }).loads ?? 0), 0, "its load never ran in the browser");
  });
});

// DERIVED-C3 / M6-PARITY task 3: `Suspense` under the derived model — the server awaits its content in place and ships each
// resource's settled state on its boundary (`$r`), so the unit holding it adopts: its resources do not load again, the
// `Async` inside adopts its value. (DERIVED-C3 rendered the unit in the browser; before that, the probe run's disposal
// wrote the Suspense's pending count into its disposed owner and the page reloaded.)
const SUSPENDED = `import { signal } from "@rivetjs/reactivity";
import { Async, Suspense, resource } from "@rivetjs/runtime/dom";
export function App(props: { n: number }) {
  const count = signal(0);
  const user = resource(() => props.n, (key) => ((globalThis as { fetches?: number }).fetches = ((globalThis as { fetches?: number }).fetches ?? 0) + 1, new Promise<string>((done) => setTimeout(() => done("u" + key), 5))));
  return (
    <section>
      <button id="count" onClick={() => count.set(count() + 1)}>{count()}</button>
      <Suspense fallback={() => <p id="wait">wait</p>}>
        {() => (
          <div>
            <b id="user">{user()}</b>
            <Async load={() => Promise.resolve({ x: "ax" })}>{(v) => <i id="a">{v.x}</i>}</Async>
          </div>
        )}
      </Suspense>
    </section>
  );
}
`;
compiled("a unit holding a Suspense adopts the server's resource state (no load in the browser), then works", async () => {
  const resume = { module: "src/page.tsx", boundaries: ["App"], independent: ["App"] };
  const server = compile(SUSPENDED, { target: "server", filename: "page.tsx", resume } as never);
  const dom = compile(SUSPENDED, { target: "dom", filename: "page.tsx", resume } as never);
  assert.deepEqual(server.diagnostics, []);
  const { App } = await importServer<{ App: (props: { n: number }) => ServerValue }>(server.code);
  const html = (await derivedToString(() => App({ n: 1 }), { manifest: { ...manifest, symbols: { "src/page.tsx#App": "/page.js" } } })) as string;
  assert.match(html, /<b id="user">u1<\/b>.*<i id="a">ax<\/i>/);
  await withPage(files(html, rewrite(dom.code)), async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() =>
      document.addEventListener("rivet:resume-error", (event) => {
        event.preventDefault();
        console.error("resume error " + String((event as CustomEvent).detail));
      }),
    );
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    await page.goto("http://rivet.test/");
    await page.evaluate(
      () => (((document.querySelector("#user") as unknown as { __t: number }).__t = 1), ((document.querySelector("#a") as unknown as { __t: number }).__t = 1)),
    );
    await page.click("#count");
    await page.waitForFunction(() => document.querySelector("#count")!.textContent === "1");
    await page.waitForFunction(() => document.querySelector("#user")?.textContent === "u1" && document.querySelector("#a")?.textContent === "ax");
    assert.deepEqual(
      await page.evaluate(() => [
        (document.querySelector("#user") as unknown as { __t?: number }).__t,
        (document.querySelector("#a") as unknown as { __t?: number }).__t,
        (globalThis as { fetches?: number }).fetches ?? 0,
      ]),
      [1, 1, 0],
      "server nodes kept, no fetch in the browser",
    );
    assert.deepEqual(errors, []);
  });
});

// M6-PARITY task 3: a Suspense build discarded because a resource was pending drops the boundaries and counts it recorded
// (`server-derived.ts` resource `cut`): the build that renders numbers them as the browser's single run does.
const REBUILT = `import { signal } from "@rivetjs/reactivity";
import { Suspense, resource } from "@rivetjs/runtime/dom";
export function Inner(props: { label: string }) {
  const n = signal(0);
  return <button id={"inner-" + props.label} onClick={() => n.set(n() + 1)}>{props.label + n()}</button>;
}
export function App() {
  const count = signal(0);
  const user = resource(() => ((globalThis as { fetches?: number }).fetches = ((globalThis as { fetches?: number }).fetches ?? 0) + 1, new Promise<string>((done) => setTimeout(() => done("u"), 5))));
  const plain = resource(() => "p");
  return (
    <section>
      <button id="count" onClick={() => count.set(count() + 1)}>{count()}</button>
      <Suspense fallback={() => <p id="wait">wait</p>}>
        {() => (
          <div>
            <Inner label="a" />
            <b id="user">{user()}</b>
            <Inner label="b" />
          </div>
        )}
      </Suspense>
      <i id="plain">{plain()}</i>
    </section>
  );
}
`;
compiled("a discarded Suspense build leaves no records: the boundaries of the rendered build adopt", async () => {
  const resume = { module: "src/page.tsx", boundaries: ["App", "Inner"], independent: ["App"] };
  const server = compile(REBUILT, { target: "server", filename: "page.tsx", resume } as never);
  const dom = compile(REBUILT, { target: "dom", filename: "page.tsx", resume } as never);
  assert.deepEqual(server.diagnostics, []);
  const { App } = await importServer<{ App: () => ServerValue }>(server.code);
  const symbols = { "src/page.tsx#App": "/page.js", "src/page.tsx#Inner": "/page.js" };
  const html = (await derivedToString(() => App(), { manifest: { ...manifest, symbols } })) as string;
  const tail = tailJson(JSON.parse(/<script type="rivet\/boundaries"[^>]*>(.*?)<\/script>/s.exec(html)![1]!));
  assert.deepEqual(
    tail.b.map((r: unknown[]) => r.slice(0, 2)),
    [
      [1, 0],
      [2, 1],
      [3, 1],
    ],
    "one record per rendered boundary, numbered on",
  );
  const values = tail.b[0][4] as unknown[];
  assert.deepEqual(
    values.flatMap((v, i) => (i % 2 === 0 && String(v).startsWith("$r") ? [v, values[i + 1]] : [])),
    ["$r", { s: 2, v: "u" }, "$r#2", { s: 2, v: "p" }],
    "each resource's settled state, in creation order",
  );
  await withPage(files(html, rewrite(dom.code)), async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/");
    await page.evaluate(() => void ((document.querySelector("#user") as unknown as { __t: number }).__t = 1));
    await page.click("#inner-b");
    await page.waitForFunction(() => document.querySelector("#inner-b")!.textContent === "b1");
    await page.click("#count");
    await page.waitForFunction(() => document.querySelector("#count")!.textContent === "1");
    assert.deepEqual(
      await page.evaluate(() => [(document.querySelector("#user") as unknown as { __t?: number }).__t, (globalThis as { fetches?: number }).fetches ?? 0]),
      [1, 0],
    );
    assert.equal(await page.textContent("#plain"), "p");
    assert.deepEqual(errors, []);
  });
});

// DERIVED-GAPS 02: a streamed `Suspense` on the derived model. Pending once its content is constructed, it writes its
// fallback in the shell (`<!--sN-->…<!--/s-->`, rendered plainly), its content after the shell (`<template data-s>` +
// `$rS`), then the tail — settled resource state included — so the browser adopts the page an in-place render writes.
const STREAMED_SUSPENSE = `import { signal } from "@rivetjs/reactivity";
import { Async, Suspense, resource } from "@rivetjs/runtime/dom";
export function Inner(props: { label: string }) {
  const n = signal(0);
  return <button id={"inner-" + props.label} onClick={() => n.set(n() + 1)}>{props.label + n()}</button>;
}
export function App(props: { gate: PromiseLike<void> }) {
  const count = signal(0);
  const user = resource(() => ((globalThis as { fetches?: number }).fetches = ((globalThis as { fetches?: number }).fetches ?? 0) + 1, Promise.resolve(props.gate).then(() => "u")));
  return (
    <section>
      <button id="count" onClick={() => count.set(count() + 1)}>{count()}</button>
      <Suspense fallback={() => <p id="wait">wait</p>}>
        {() => (
          <div id="content">
            <b id="user">{user()}</b>
            <Inner label="a" />
            <Async load={() => ((globalThis as { loads?: number }).loads = ((globalThis as { loads?: number }).loads ?? 0) + 1, Promise.resolve(props.gate).then(() => ({ x: "ax" })))} fallback={() => <i id="inner-wait">…</i>}>
              {(v) => <i id="a">{v.x}</i>}
            </Async>
          </div>
        )}
      </Suspense>
      <Suspense fallback={() => <p id="wait2">wait</p>}>
        {() => <p id="ready">ready</p>}
      </Suspense>
    </section>
  );
}
`;
const SUSPENSE_RESUME = { module: "src/page.tsx", boundaries: ["App", "Inner"], independent: ["App"] };
const suspenseManifest = { hash: "t", runtime: "/rt.js", symbols: { "src/page.tsx#App": "/page.js", "src/page.tsx#Inner": "/page.js" } };
async function buildSuspense(): Promise<{ App: (props: { gate: PromiseLike<void> }) => ServerValue; dom: string }> {
  const server = compile(STREAMED_SUSPENSE, { target: "server", filename: "page.tsx", resume: SUSPENSE_RESUME } as never);
  const dom = compile(STREAMED_SUSPENSE, { target: "dom", filename: "page.tsx", resume: SUSPENSE_RESUME } as never);
  assert.deepEqual(server.diagnostics, []);
  assert.deepEqual(dom.diagnostics, []);
  const { App } = await importServer<{ App: (props: { gate: PromiseLike<void> }) => ServerValue }>(server.code);
  return { App, dom: rewrite(dom.code) };
}
async function streamedSuspense(App: (props: { gate: PromiseLike<void> }) => ServerValue, gate: Promise<void>, deadline?: number): Promise<string[]> {
  const chunks: string[] = [];
  await renderDerived(
    () => App({ gate }),
    { write: (chunk: string) => void chunks.push(chunk) },
    { manifest: suspenseManifest, stream: deadline === undefined ? {} : { deadline } },
  );
  return chunks;
}

compiled("server: a pending Suspense streams — fallback in the shell, its content after it, the settled tail last", async () => {
  const { App } = await buildSuspense();
  const chunks = await streamedSuspense(App, new Promise((resolve) => setTimeout(resolve, 5)));
  const html = chunks.join("");
  const at = html.indexOf("<script>(function(){const d=document;window.$rS=");
  assert.ok(at > 0, "the content streams as a template");
  const shell = html.slice(0, at);
  assert.match(shell, /<!--s1--><p id="wait">wait<\/p><!--\/s-->/, "the fallback between its markers, in the shell");
  assert.match(shell, /<p id="ready">ready<\/p>/, "a Suspense with nothing pending renders in place");
  assert.ok(!shell.includes("wait2") && !shell.includes("<!--s2"), "no fallback for it");
  assert.ok(!shell.includes("rivet/boundaries"), "the tail waits for the content");
  const rest = html.slice(at);
  assert.ok(rest.startsWith("<script>(function(){const d=document;window.$rS="), "the swap add-on once, before the first content");
  assert.match(
    rest,
    /<\/script><template data-s="1"><div id="content"><b id="user">u<\/b>.*<i id="a">ax<\/i><!--\/a--><!--]--><\/div><\/template><script>\$rS\(1\)<\/script><script type="rivet\/boundaries"/s,
  );
  assert.ok(!rest.includes("inner-wait"), "an Async inside a Suspense is awaited with it (no segment of its own)");
  assert.ok(!html.includes("<template data-a"), "no Async segment");
  const tail = tailJson(JSON.parse(/<script type="rivet\/boundaries"[^>]*>(.*?)<\/script>/s.exec(rest)![1]!));
  const values = tail.b[0][4] as unknown[];
  assert.deepEqual(values.slice(values.indexOf("$r"), values.indexOf("$r") + 2), ["$r", { s: 2, v: "u" }], "the resource's settled state");
  assert.ok(
    tail.b.some((r: unknown[]) => r[3] === "src/page.tsx#Inner"),
    "the content's boundary is recorded",
  );
});

compiled("server: not streaming (derivedToString), the Suspense renders in place as before", async () => {
  const { App } = await buildSuspense();
  const html = (await derivedToString(() => App({ gate: Promise.resolve() }), { manifest: suspenseManifest })) as string;
  assert.ok(!html.includes("<!--s") && !html.includes("<template"));
  assert.match(html, /<div id="content"><b id="user">u<\/b>/);
});

async function suspenseErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  await page.addInitScript(() =>
    document.addEventListener("rivet:resume-error", (event) => {
      event.preventDefault();
      console.error("resume error " + String((event as CustomEvent).detail));
    }),
  );
  return errors;
}

compiled("streamed Suspense: the swapped-in content adopts (server nodes kept, no load in the browser), the page works", async () => {
  const { App, dom } = await buildSuspense();
  const html = (await streamedSuspense(App, new Promise((resolve) => setTimeout(resolve, 5)))).join("");
  await withPage(files(html, dom), async (page) => {
    const errors = await suspenseErrors(page);
    await page.goto("http://rivet.test/");
    assert.equal(await page.$("#wait"), null, "the content replaced the fallback");
    assert.equal(
      await page.evaluate(() => document.body.innerHTML.includes("<!--s") || document.querySelector("template") !== null),
      false,
      "no marker, no template left",
    );
    await tag(page, ["#content", "#user", "#a", "#inner-a"]);
    await page.click("#inner-a");
    await page.waitForFunction(() => document.querySelector("#inner-a")!.textContent === "a1");
    await page.click("#count");
    await page.waitForFunction(() => document.querySelector("#count")!.textContent === "1");
    assert.deepEqual(await tagged(page, ["#content", "#user", "#a", "#inner-a"]), [true, true, true, true], "server nodes kept");
    assert.deepEqual(
      await page.evaluate(() => [(globalThis as { fetches?: number }).fetches ?? 0, (globalThis as { loads?: number }).loads ?? 0]),
      [0, 0],
      "no resource fetch, no Async load in the browser",
    );
    assert.deepEqual(errors, []);
  });
});

compiled("streamed Suspense over a live response: the fallback paints first, the content and the tail follow", async () => {
  const { App, dom } = await buildSuspense();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await withPage(
    files("", dom),
    async (page) => {
      const errors = await suspenseErrors(page);
      await page.goto("http://rivet.test/", { waitUntil: "commit" });
      await page.waitForSelector("#wait");
      assert.equal(await page.$("#content"), null);
      release();
      await page.waitForSelector("#content");
      assert.equal(await page.$("#wait"), null);
      await tag(page, ["#content"]);
      await page.click("#count");
      await page.waitForFunction(() => document.querySelector("#count")!.textContent === "1");
      assert.deepEqual(await tagged(page, ["#content"]), [true], "the content's nodes adopted");
      assert.equal(await page.evaluate(() => (globalThis as { fetches?: number }).fetches ?? 0), 0, "no resource fetch in the browser");
      assert.deepEqual(errors, []);
    },
    {
      streams: {
        "/": (_request, response) => {
          response.writeHead(200, { "content-type": "text/html" });
          response.write("<!doctype html><html><body>");
          void Promise.resolve(
            renderDerived(() => App({ gate }), { write: (chunk: string) => void response.write(chunk) }, { manifest: suspenseManifest, stream: {} }),
          ).then(() => response.end("</body></html>"));
        },
      },
    },
  );
});

compiled("streamed Suspense past the deadline: the fallback stays, the tail follows, the browser renders the unit", async () => {
  const { App, dom } = await buildSuspense();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const html = (await streamedSuspense(App, gate, 10)).join("");
  assert.ok(!html.includes("<template data-s"), "no content written");
  assert.match(html, /<!--s1--><p id="wait">wait<\/p><!--\/s-->/);
  assert.match(html, /<script type="rivet\/boundaries"/, "the tail is written");
  release();
  await withPage(files(html, dom), async (page) => {
    await page.goto("http://rivet.test/");
    await page.click("#count");
    await page.waitForFunction(() => document.querySelector("#count")!.textContent === "1");
    await page.waitForFunction(() => document.querySelector("#user")?.textContent === "u");
    assert.equal(await page.$("#wait"), null);
  });
});

// Nested: the inner Suspense's content streams after the outer content that holds it.
const NESTED_SUSPENSE = `import { signal } from "@rivetjs/reactivity";
import { Suspense, resource } from "@rivetjs/runtime/dom";
export function App(props: { gate: PromiseLike<void>; later: PromiseLike<void> }) {
  const count = signal(0);
  const outer = resource(() => Promise.resolve(props.gate).then(() => "o"));
  const inner = resource(() => Promise.resolve(props.later).then(() => "i"));
  return (
    <section>
      <button id="count" onClick={() => count.set(count() + 1)}>{count()}</button>
      <Suspense fallback={() => <p id="wait-o">wait</p>}>
        {() => (
          <div id="outer">
            <b>{outer()}</b>
            <Suspense fallback={() => <p id="wait-i">wait</p>}>{() => <b id="inner">{inner()}</b>}</Suspense>
          </div>
        )}
      </Suspense>
    </section>
  );
}
`;
compiled("streamed Suspense, nested: inner content after the outer content holding it; the page adopts", async () => {
  const resume = { module: "src/page.tsx", boundaries: ["App"], independent: ["App"] };
  const server = compile(NESTED_SUSPENSE, { target: "server", filename: "page.tsx", resume } as never);
  const dom = compile(NESTED_SUSPENSE, { target: "dom", filename: "page.tsx", resume } as never);
  assert.deepEqual(server.diagnostics, []);
  const { App } = await importServer<{ App: (props: { gate: PromiseLike<void>; later: PromiseLike<void> }) => ServerValue }>(server.code);
  const chunks: string[] = [];
  const gate = new Promise<void>((resolve) => setTimeout(resolve, 5)),
    later = new Promise<void>((resolve) => setTimeout(resolve, 15));
  await renderDerived(
    () => App({ gate, later }),
    { write: (chunk: string) => void chunks.push(chunk) },
    { manifest: { ...manifest, symbols: { "src/page.tsx#App": "/page.js" } }, stream: {} },
  );
  const html = chunks.join("");
  const outerAt = html.search(/<template data-s="\d+"><div id="outer">/),
    innerAt = html.search(/<template data-s="\d+"><b id="inner">i<\/b>/);
  assert.ok(outerAt > 0 && innerAt > outerAt, "outer content, then inner");
  assert.ok(html.indexOf("rivet/boundaries") > innerAt, "the tail last");
  await withPage(files(html, rewrite(dom.code)), async (page) => {
    const errors = await suspenseErrors(page);
    await page.goto("http://rivet.test/");
    assert.equal(await page.textContent("#inner"), "i");
    assert.equal(await page.$("#wait-o"), null);
    assert.equal(await page.$("#wait-i"), null);
    await tag(page, ["#outer", "#inner"]);
    await page.click("#count");
    await page.waitForFunction(() => document.querySelector("#count")!.textContent === "1");
    assert.deepEqual(await tagged(page, ["#outer", "#inner"]), [true, true]);
    assert.deepEqual(errors, []);
  });
});

// DERIVED-GAPS 03: a resource value that is not JSON data (a `Date`) ships as its resume table (`$r` = `{ j }`); with the
// table decoder the router's `Root` installs, the unit holding its Suspense adopts with it (no fetch in the browser);
// without one the browser loads it as before.
const DATED_RESOURCE = `import { signal } from "@rivetjs/reactivity";
import { Suspense, resource } from "@rivetjs/runtime/dom";
export function App() {
  const count = signal(0);
  const peek = signal("");
  const when = resource(() => ((globalThis as { fetches?: number }).fetches = ((globalThis as { fetches?: number }).fetches ?? 0) + 1, new Promise<{ at: Date }>((done) => setTimeout(() => done({ at: new Date(86400000) }), 5))));
  return (
    <section>
      <button id="count" onClick={() => count.set(count() + 1)}>{count()}</button>
      <button id="peek" onClick={() => peek.set(when.state() + " " + (when.latest()?.at instanceof Date ? "date" : "none"))}>{peek()}</button>
      <Suspense fallback={() => <p id="wait">wait</p>}>
        {() => <b id="when">{when()?.at instanceof Date ? when()!.at.toISOString().slice(0, 10) : "not a date"}</b>}
      </Suspense>
    </section>
  );
}
`;
async function datedPage(): Promise<{ html: string; dom: string }> {
  const resume = { module: "src/page.tsx", boundaries: ["App"], independent: ["App"] };
  const server = compile(DATED_RESOURCE, { target: "server", filename: "page.tsx", resume } as never);
  const dom = compile(DATED_RESOURCE, { target: "dom", filename: "page.tsx", resume } as never);
  assert.deepEqual(server.diagnostics, []);
  const { App } = await importServer<{ App: () => ServerValue }>(server.code);
  const html = (await derivedToString(() => App(), { manifest: { ...manifest, symbols: { "src/page.tsx#App": "/page.js" } } })) as string;
  return { html, dom: rewrite(dom.code) };
}

compiled("server: a resource value that is not JSON data ships as its resume table", async () => {
  const { html } = await datedPage();
  assert.match(html, /<b id="when">1970-01-02<\/b>/);
  const values = tailJson(JSON.parse(/<script type="rivet\/boundaries"[^>]*>(.*?)<\/script>/s.exec(html)![1]!)).b[0][4] as unknown[];
  const seed = values[values.indexOf("$r") + 1] as { j: { t: unknown[]; r: number } };
  const { createDecoder } = await import("@rivetjs/runtime/resume-format");
  const decoded = createDecoder(seed.j.t).get(seed.j.r) as { s: number; v: { at: Date } };
  assert.equal(decoded.s, 2);
  assert.ok(decoded.v.at instanceof Date && decoded.v.at.getTime() === 86400000);
});

compiled("a table-encoded resource value adopts with the installed decoder (no fetch); without one it loads in the browser", async () => {
  const { html, dom } = await datedPage();
  const rt = 'import { _useTableDecoder } from "/resume-format.ts"; _useTableDecoder(); export { default } from "/dom-derived.ts";';
  for (const decoder of [true, false])
    await withPage({ ...files(html, dom), ...(decoder ? { "/rt.js": rt } : {}) }, async (page) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("http://rivet.test/");
      await tag(page, ["#when"]);
      await page.click("#count");
      await page.waitForFunction(() => document.querySelector("#count")!.textContent === "1");
      await page.click("#peek");
      await page.waitForFunction(() => document.querySelector("#peek")!.textContent !== "");
      const peeked = await text(page, "#peek"),
        fetches = await page.evaluate(() => (globalThis as { fetches?: number }).fetches ?? 0);
      if (decoder) {
        assert.equal(peeked, "ready date", "the server's state, decoded");
        assert.equal(fetches, 0, "no fetch in the browser");
        assert.deepEqual(await tagged(page, ["#when"]), [true], "server nodes kept");
      } else assert.ok(fetches >= 1, "without a decoder the browser loads it (the unit renders in the browser, as before)");
      assert.deepEqual(errors, []);
    });
});
