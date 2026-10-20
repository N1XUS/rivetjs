// resource() SSR → resume (Chromium): the server's values reach the browser as captured state (no load at boot or on
// the first use), a source change / refetch loads in the browser, mutate needs no load, an `ssr: false` resource loads
// once the page resumed. Lane RESOURCE, spec docs/design/specs/2026-10-20-resource-design.md.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { renderResumable, resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compileResume, compileSymbolModule, importServer } from "./resume/compile.ts";
import type { ResumeSymbol } from "./resume/compile.ts";
import { withPage, rewrite } from "./resume/harness.ts";
import { withIdScope } from "@rivetjs/runtime/id";
import type { Served } from "./resume/harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;

const source = await readFile(new URL("./resume/resource-fixture.tsx", import.meta.url), "utf8");
const dom = compileResume(source, "dom", "src/resource.tsx");
const server = await importServer<{ Page(): ServerValue }>(compileResume(source, "server", "src/resource.tsx").code);
const manifest: ResumeManifest = {
  hash: "resource",
  runtime: "/rt.js",
  symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])),
};
const calls: unknown[] = [];
(globalThis as { __load?: unknown }).__load = async (key: unknown) => (calls.push(key), "server " + String(key));
const html = await resumableToString(() => server.Page(), { manifest });

test("server: the Suspense renders the loaded values; the fetchers ran once; ssr: false did not run", () => {
  assert.match(html, /<b id="user">(<!--[^>]*-->)*server 1(<!--[^>]*-->)*<\/b>/);
  assert.match(html, /<i id="state">(<!--[^>]*-->)*ready/);
  assert.match(html, /<b id="card">(<!--[^>]*-->)*server card10/);
  assert.doesNotMatch(html, /id="wait"/);
  assert.match(html, /<p id="later">(<!--[^>]*-->)*pending/);
  assert.deepEqual(calls.sort(), [1, "card10"].sort());
});

test("streaming: the Suspense flushes its fallback first, then a segment with the loaded values", async () => {
  const chunks: string[] = [];
  await renderResumable(() => server.Page(), { write: (chunk) => void chunks.push(chunk) }, { manifest, stream: {} });
  const out = chunks.join("");
  const fallback = out.indexOf('<p id="wait">wait</p>'),
    segment = out.indexOf("<template data-a=");
  assert.ok(fallback >= 0 && segment > fallback, out);
  assert.match(out.slice(segment), /<b id="user">(<!--[^>]*-->)*server 1/);
  assert.match(out.slice(segment), /<b id="card">(<!--[^>]*-->)*server card10/);
});

test("a clientOnly part inside content rebuilt for a resource keeps its mount record", async () => {
  const page = `
import { signal } from "@rivetjs/reactivity";
import { Suspense, resource, clientOnly } from "@rivetjs/runtime/dom";
const Chart = clientOnly(() => import("./chart.tsx"), undefined, { fallback: () => <i id="chart">chart</i> });
export function Page() {
  const id = signal(1);
  const user = resource(() => id(), (key) => new Promise<string>((done) => setTimeout(() => done("u" + key), 5)));
  return (
    <main>
      <Suspense fallback={() => <p>wait</p>}>
        {() => (
          <section>
            <b>{user()}</b>
            <Chart />
          </section>
        )}
      </Suspense>
      <button onClick={() => id.set(id() + 1)}>n</button>
    </main>
  );
}`;
  const client = compileResume(page, "dom", "src/chart-page.tsx");
  const mod = await importServer<{ Page(): ServerValue }>(compileResume(page, "server", "src/chart-page.tsx").code);
  const out = await resumableToString(() => mod.Page(), {
    manifest: { hash: "chart", runtime: "/rt.js", symbols: Object.fromEntries(client.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])) },
  });
  const region = /<!--r(\d+)\[--><i id="chart">/.exec(out);
  assert.ok(region, out);
  // The discarded first build's records are cut; the rebuilt content's clientOnly mount is recorded once.
  assert.equal(out.match(/"visible"\]/g)?.length, 1, out);
  assert.match(out, new RegExp(`\\[${region[1]},"#",\\d+,\\[\\],\\[\\],\\[0\\],-1,"visible"\\]`));
});

test("lazy rows (RIVET_LAZY_ROWS=on, opted-in build): a For over a resource's value inside the Suspense writes one lazy entry", async () => {
  const page = `
import { signal } from "@rivetjs/reactivity";
import { For, Suspense, resource } from "@rivetjs/runtime/dom";
export function Page() {
  const id = signal(1);
  const rows = resource(() => id(), (key) => new Promise<{ id: number; label: string }[]>((done) => setTimeout(() => done([{ id: 1, label: "a" + key }, { id: 2, label: "b" + key }]), 5)));
  const sel = signal(0);
  return (
    <main>
      <Suspense fallback={() => <p>wait</p>}>
        {() => (
          <ul>
            <For each={() => rows() ?? []} by={(r) => r.id}>{(row) => <li onClick={() => sel.set(row().id)}>{row().label}</li>}</For>
          </ul>
        )}
      </Suspense>
      <button onClick={() => id.set(id() + 1)}>n</button>
    </main>
  );
}`;
  const client = compileResume(page, "dom", "src/rows.tsx");
  const mod = await importServer<{ Page(): ServerValue }>(compileResume(page, "server", "src/rows.tsx").code);
  const symbols = Object.fromEntries(client.symbols.map((s) => [s.id, "/c/" + s.component + ".js"]));
  process.env.RIVET_LAZY_ROWS = "on";
  let out: string;
  try {
    out = (await resumableToString(() => withIdScope("rv", () => mod.Page()), { manifest: { runtime: "/rt.js", symbols, lazyRows: true } })) as string;
  } finally {
    delete process.env.RIVET_LAZY_ROWS;
  }
  assert.match(out, /<li>a1<\/li>.*<li>b1<\/li>/s);
  const state = JSON.parse(/<script type="rivet\/state"[^>]*>(.*?)<\/script>/s.exec(out)![1]!) as { t: unknown[]; L?: unknown[][] };
  assert.equal(state.L?.length, 1, out);
  // The rows' items are the resource's value: one table entry, shared with the resource seed.
  const items = state.L![0]![3] as number;
  assert.deepEqual(state.t[items], {
    j: [
      { id: 1, label: "a1" },
      { id: 2, label: "b1" },
    ],
  });
  assert.ok(
    state.t.some((e) => Array.isArray((e as { p?: unknown[] }).p) && JSON.stringify((e as { p: unknown[] }).p).includes(`"v",[${items}]`)),
    out,
  );
});

const byComponent: Record<string, ResumeSymbol[]> = {};
for (const symbol of dom.symbols) (byComponent["/c/" + symbol.component + ".js"] ??= []).push(symbol);
const files: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
  "/": "<!doctype html><html><head></head><body>" + html + "</body></html>",
};
for (const [path, symbols] of Object.entries(byComponent)) files[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));

test("resume: values come from the server; source changes and refetch load in the browser; mutate is local", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      const w = window as unknown as { __calls: unknown[]; __load: (key: unknown) => Promise<string> };
      w.__calls = [];
      w.__load = (key) => (w.__calls.push(key), new Promise((resolve) => setTimeout(() => resolve("browser " + String(key)), 20)));
    });
    await page.goto("http://rivet.test/");
    const text = (selector: string, value: string) =>
      page
        .waitForFunction(([s, v]) => document.querySelector(s!)?.textContent === v, [selector, value], { timeout: 5000 })
        .catch(async () => {
          const main = await page.evaluate(() => document.querySelector("main")!.outerHTML);
          throw new Error(`${selector} text ${value}; errors: ${errors.join(" | ")}; main: ${main}`);
        });
    const browserCalls = () => page.evaluate(() => (window as unknown as { __calls: unknown[] }).__calls.slice());
    // ssr: false: the reading region re-creates itself at idle and loads in the browser.
    await text("#later", "browser later");
    assert.deepEqual(await browserCalls(), ["later"], "only the ssr: false resource loads at boot");
    // mutate: local, no load.
    await page.click("#mutate");
    await text("#user", "local");
    assert.deepEqual(await browserCalls(), ["later"]);
    // A source change: the resumed resource loads the new key (once), keeping the shown value meanwhile.
    await page.click("#next");
    await text("#user", "browser 2");
    await text("#state", "ready");
    // refetch with the current key.
    await page.click("#refetch");
    await text("#user", "browser 2");
    // A resource created inside the rebuilt Suspense content resumes too.
    await page.click("#card-next");
    await text("#card", "browser card11");
    assert.deepEqual(await browserCalls(), ["later", 2, 2, "card11"]);
    assert.deepEqual(errors, []);
  });
});
