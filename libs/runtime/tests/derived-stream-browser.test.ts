// Derived model, streamed holes (DERIVED-C2): an `Async` with a fallback whose load is pending writes `<!--a<id>-->…<!--/a-->`
// and a tail / patch entry (`a`: its unit, its place, then its value). Awaited in place (no stream), the content and its
// value are in the shell; streamed (`renderDerived` with `stream`), the fallback is, and the content follows as a segment
// (`<template data-a>` + patch + `$rD`). The browser's adopt run makes that `Async` a hole and adopts its content with the
// server's value — its `load` never runs — whether the segment landed before the runtime started or after the unit adopted.
// Compiled with the real derived server + DOM targets (skips on a wasm without the model).
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString, renderDerived } from "@rivetjs/runtime/server-derived";
import type { Page } from "playwright";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, rewrite, withPage } from "./resume/harness.ts";

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
  const tail = JSON.parse(/<script type="rivet\/boundaries"[^>]*>(.*?)<\/script>/s.exec(html)![1]!);
  assert.deepEqual(tail.a, [[1, 1, 0, 1, ITEMS]]);
  assert.ok(!html.includes("$rD"), "no stream add-on without streaming");
});

compiled("server: streamed — fallback in the shell (entry pending), the content as a segment with its value and records", async () => {
  const { App } = await build();
  const chunks = await streamed(App, Promise.resolve());
  const html = chunks.join("");
  const shell = html.slice(0, html.indexOf("<template"));
  assert.match(shell, /<!--a1--><p id="wait">wait<\/p><!--\/a-->/);
  assert.deepEqual(JSON.parse(/<script type="rivet\/boundaries" data-rt[^>]*>(.*?)<\/script>/s.exec(shell)![1]!).a, [[1, 1, 0]]);
  assert.equal(html.match(/window\.\$rD=/g)?.length, 1, "the swap add-on once");
  const patch = JSON.parse(/<script type="rivet\/boundaries" data-patch="1">(.*?)<\/script>/s.exec(html)![1]!);
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
  assert.deepEqual(JSON.parse(/data-patch="1">(.*?)<\/script>/s.exec(html)![1]!).a, [[1, 1, 0, 0]]);
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
  const tail = JSON.parse(/<script type="rivet\/boundaries" data-rt[^>]*>(.*?)<\/script>/s.exec(html)![1]!);
  const app = tail.b.find((r: unknown[]) => r[3] === "src/page.tsx#App")[0];
  assert.deepEqual(tail.a, [[1, app, 0]], "keyed by App (its body made the provider), place 0");
  const patch = JSON.parse(/data-patch="1">(.*?)<\/script>/s.exec(html)![1]!);
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
  const [entry] = JSON.parse(/<script type="rivet\/boundaries" data-patch="1">(.*?)<\/script>/s.exec(html)![1]!).a;
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
  const tail = JSON.parse(/<script type="rivet\/boundaries"[^>]*>(.*?)<\/script>/s.exec(html)![1]!);
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
