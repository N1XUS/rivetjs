// Framework islands on the derived resume model (M6-PARITY), end to end in Chromium over a real Vite build of the fixture
// app (`rivet({ resume, bridges })`): a page whose only interactive parts are lean islands (JSON
// props) ships the bridge's islands boot and no Rivet runtime; a page with a live prop + a callback marks its boundary
// with the island's policy (`client="load"` → LOAD), the boundaries tail names the island (`i`), the derived runtime
// adopts the boundary and the adopt run hydrates the island (`_island` hole over `<rivet-island data-ri>`); the callback
// writes a Rivet signal (adopted binding + live prop update in place). The `visible` badge stays on the lean boot.
import { afterAll, test } from "vitest";
import assert from "node:assert/strict";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "vite";
import { rivet } from "@rivetjs/compiler/vite";
import { hasWebkit, withPage } from "../../runtime/tests/resume/harness.ts";
import { fixtureApp } from "./app.ts";

const app = await fixtureApp("derived");
afterAll(() => app.remove());
await writeFile(
  resolve(app.root, "src/islands.tsx"),
  `import { Counter } from "./Counter.fake.js";
import { Badge } from "./Hooks.fake.js";
export function Islands() {
  return <main><h1>static</h1><Counter client="load" count={1} /><Badge client="visible" label="badge" /></main>;
}
`,
);
await writeFile(
  resolve(app.root, "src/slotted.tsx"),
  `import { signal } from "@rivetjs/reactivity";
import { Counter } from "./Counter.fake.js";
export function Slotted() {
  const n = signal(0);
  return <main><Counter client="load" count={1}><button class="inner" onClick={() => n.set(n() + 1)}>{n()}</button></Counter><p class="outer">{n()}</p></main>;
}
`,
);
// E1: an island whose only Rivet-needing prop is live (no callback, no slot) still follows the signal.
await writeFile(
  resolve(app.root, "src/live.tsx"),
  `import { signal } from "@rivetjs/reactivity";
import { Counter } from "./Counter.fake.js";
export function Live() {
  const n = signal(1);
  return <main><button class="bump" onClick={() => n.set(n() + 1)}>bump</button><p class="total">{n()}</p><Counter client="load" count={n()} label="x" /></main>;
}
`,
);
// E4 (ruling 2026-10-27): a below-the-fold `visible` island its boundary hydrates (live prop): its chunk is fetched
// near the viewport (prefetch-only lean record), not in the idle fetch-ahead.
await writeFile(
  resolve(app.root, "src/below.tsx"),
  `import { signal } from "@rivetjs/reactivity";
import { Counter } from "./Counter.fake.js";
export function Below() {
  const n = signal(1);
  return <main><button class="bump" onClick={() => n.set(n() + 1)}>bump</button><div style={{ height: "400vh" }}></div><Counter client="visible" count={n()} /></main>;
}
`,
);
await writeFile(
  resolve(app.root, "src/entry-derived.tsx"),
  `import { derivedToString } from "@rivetjs/runtime/server-derived";
import { Islands } from "./islands.tsx";
import { Page } from "./page.tsx";
import { Slotted } from "./slotted.tsx";
import { Live } from "./live.tsx";
import { Below } from "./below.tsx";
export const below = (manifest: never) => derivedToString(() => <Below />, { manifest });
export const live = (manifest: never) => derivedToString(() => <Live />, { manifest });
export const slotted = (manifest: never) => derivedToString(() => <Slotted />, { manifest });
export const islands = (manifest: never) => derivedToString(() => <Islands />, { manifest });
export const mixed = (manifest: never) => derivedToString(() => <Page />, { manifest });
`,
);
const plugins = () => [
  rivet({ resume: { modules: ["src/page.tsx", "src/islands.tsx", "src/slotted.tsx", "src/live.tsx", "src/below.tsx"] }, bridges: [app.fake()] }),
];
await build({ configFile: false, root: app.root, logLevel: "silent", plugins: plugins(), build: { outDir: "dist", minify: false } });
await build({
  configFile: false,
  root: app.root,
  logLevel: "silent",
  plugins: plugins(),
  build: { outDir: "dist-server", ssr: "src/entry-derived.tsx", minify: false },
});
const manifest = JSON.parse(await readFile(resolve(app.root, "dist/.vite/rivet-resume.json"), "utf8")) as {
  runtime: string;
  islands?: Record<string, string>;
};
const entry = (await import(pathToFileURL(resolve(app.root, "dist-server/entry-derived.js")).href)) as Record<
  "islands" | "mixed" | "slotted" | "live" | "below",
  (m: unknown) => Promise<string>
>;
const assets: Record<string, string> = {};
for (const file of await readdir(resolve(app.root, "dist/assets")))
  if (file.endsWith(".js")) assets["/assets/" + file] = await readFile(resolve(app.root, "dist/assets", file), "utf8");
const pageOf = (html: string) => ({ ...assets, "/": "<!doctype html><html><head></head><body>" + html + "</body></html>" });
type Log = unknown[][];
const log = (page: import("playwright").Page) => page.evaluate(() => ((globalThis as unknown as { __fake?: Log }).__fake ?? []).map((e) => e.slice(0, 2)));

test("manifest: island chunks keyed like the serialized manifest", () => {
  assert.deepEqual(Object.keys(manifest.islands ?? {}).sort(), ["src/Counter.fake.js#Counter", "src/Hooks.fake.js#Badge"]);
});

test("islands-only page: the lean islands boot hydrates both islands, no Rivet runtime", async () => {
  const html = await entry.islands(manifest);
  assert.ok(html.includes('<script type="rivet/islands">') && !html.includes("rivet/boundaries"), html);
  await withPage(pageOf(html), async (page, requests) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto("http://rivet.test/");
    await page.waitForFunction(() => ((globalThis as unknown as { __fake?: Log }).__fake ?? []).length === 2);
    assert.deepEqual((await log(page)).sort(), [
      ["hydrate", "i0"],
      ["hydrate", "i1"],
    ]);
    assert.ok(!requests.includes(manifest.runtime), requests.join(" "));
    assert.deepEqual(errors, []);
  });
});

test("mixed page: the boundary adopts on load, its adopt run hydrates the island; callback → signal → binding + live prop", async () => {
  const html = await entry.mixed(manifest);
  const tail = JSON.parse(/<script type="rivet\/boundaries"[^>]*>(.*?)<\/script>/s.exec(html)![1]!);
  // Ids continue a process-wide count outside an id scope (`ids.ts`): the counter is the first island of this page.
  const [counter, badge] = [...html.matchAll(/data-ri="(i\d+)"/g)].map((m) => m[1]!);
  assert.deepEqual(tail.i, [counter]);
  assert.ok(tail.b[0][2] & 32, "LOAD flag on the island's boundary");
  await withPage(pageOf(html), async (page, requests) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    await page.goto("http://rivet.test/");
    await page.waitForFunction(() => ((globalThis as unknown as { __fake?: Log }).__fake ?? []).length === 2);
    assert.deepEqual((await log(page)).sort(), [
      ["hydrate", counter],
      ["hydrate", badge],
    ]);
    assert.ok(requests.includes(manifest.runtime), requests.join(" "));
    // Server nodes kept (hydrated, not re-rendered).
    await page.evaluate(() => ((document.querySelector("rivet-island .count") as unknown as { __kept: boolean }).__kept = true));
    await page.click("rivet-island button");
    await page.waitForFunction(
      () => document.querySelector(".total")?.textContent === "2" && document.querySelector("rivet-island .count")?.textContent === "2",
    );
    assert.equal(await page.evaluate(() => (document.querySelector("rivet-island .count") as unknown as { __kept?: boolean }).__kept), true);
    // Hydrated once (the lean boot does not own i0; the adopt run does not touch the lean i1).
    assert.equal((await log(page)).filter((e) => e[0] === "hydrate").length, 2);
    assert.deepEqual(errors, []);
  });
});

test("slot with Rivet content: the island hydrates in the adopt run, the slot's Rivet handler and binding work", async () => {
  const html = await entry.slotted(manifest);
  await withPage(pageOf(html), async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    await page.goto("http://rivet.test/");
    await page.waitForFunction(() => ((globalThis as unknown as { __fake?: Log }).__fake ?? []).length === 1);
    await page.click("button.inner");
    await page.waitForFunction(() => document.querySelector(".outer")?.textContent === "1" && document.querySelector("button.inner")?.textContent === "1");
    assert.deepEqual(errors, []);
  });
});

test("live prop only (no callback, no slot): the boundary hydrates the island, a Rivet write updates it (E1)", async () => {
  const html = await entry.live(manifest);
  const tail = JSON.parse(/<script type="rivet\/boundaries"[^>]*>(.*?)<\/script>/s.exec(html)![1]!);
  const [island] = [...html.matchAll(/data-ri="(i\d+)"/g)].map((m) => m[1]!);
  assert.ok(!html.includes('<script type="rivet/islands">'), "not a lean record: its prop is live");
  assert.deepEqual(tail.i, [island]);
  await withPage(pageOf(html), async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    await page.goto("http://rivet.test/");
    await page.waitForFunction(() => ((globalThis as unknown as { __fake?: Log }).__fake ?? []).length === 1);
    await page.click("button.bump");
    await page.click("button.bump");
    await page.waitForFunction(
      () => document.querySelector(".total")?.textContent === "3" && document.querySelector("rivet-island .count")?.textContent === "3",
      undefined,
      { timeout: 5000 },
    );
    assert.deepEqual(errors, []);
  });
});

// E3: a cold click on Rivet content inside an island slot, held while the page's chunks are slow: the adopt run renders
// the slot content again into the island's holes, the replay lands on the new node (retarget), not the removed server one.
for (const engine of ["chromium", "webkit"] as const)
  test.skipIf(engine === "webkit" && !hasWebkit())(`slot with Rivet content: a cold click before the chunks load is replayed (E3, ${engine})`, async () => {
    const html = await entry.slotted(manifest);
    let release!: () => void;
    const gate = new Promise<void>((go) => (release = go));
    const delays = Object.fromEntries(Object.keys(assets).map((path) => [path, gate]));
    await withPage(
      pageOf(html),
      async (page) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(String(error)));
        page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
        await page.goto("http://rivet.test/", { waitUntil: "domcontentloaded" });
        await page.click("button.inner");
        release();
        await page.waitForFunction(
          () => document.querySelector(".outer")?.textContent === "1" && document.querySelector("button.inner")?.textContent === "1",
          undefined,
          {
            timeout: 5000,
          },
        );
        assert.deepEqual(errors, []);
      },
      { delays, engine },
    );
  });

test("visible island hydrated by its boundary, below the fold: no chunk before the user scrolls near it, hydrated when visible (E4)", async () => {
  const html = await entry.below(manifest);
  const chunk = manifest.islands!["src/Counter.fake.js#Counter"]!;
  const fo = /data-fo="([^"]*)"/.exec(html)?.[1] ?? "";
  assert.ok(!fo.split(" ").includes(chunk), "island chunk not in the idle fetch-ahead: " + fo);
  const records = JSON.parse(/<script type="rivet\/islands"[^>]*>(.*?)<\/script>/s.exec(html)![1]!);
  assert.equal(records.length, 1);
  assert.deepEqual(records[0].slice(1, 4), [chunk, null, "visible"]);
  await withPage(pageOf(html), async (page, requests) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    await page.goto("http://rivet.test/");
    await page.waitForTimeout(1500);
    assert.ok(!requests.includes(chunk), "no island chunk before scrolling: " + requests.join(" "));
    await page.evaluate(() => {
      const box = document.querySelector("rivet-island .counter")!;
      window.scrollTo(0, box.getBoundingClientRect().top + window.scrollY - window.innerHeight * 1.5);
    });
    await page.waitForFunction(() => performance.getEntriesByType("resource").some((entry) => entry.name.includes("Counter")), undefined, { timeout: 5000 });
    assert.deepEqual(await log(page), []);
    await page.evaluate(() => document.querySelector("rivet-island .counter")!.scrollIntoView());
    await page.waitForFunction(() => ((globalThis as unknown as { __fake?: Log }).__fake ?? []).length === 1, undefined, { timeout: 5000 });
    assert.deepEqual(errors, []);
  });
});
