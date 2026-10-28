// Production derived resume: a server-rendered PresenceFor row must finish its exit and leave the list.
import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "vite";
import { chromium } from "playwright";
import { rivet } from "../../compiler/vite.ts";

const PAGE = `import { signal } from "@rivetjs/reactivity";
import { Motion } from "@rivetjs/motion";
import { Presence, PresenceFor } from "@rivetjs/motion/presence";
export default function Page() {
  const open = signal(true);
  const items = signal([{ id: 1, text: "First" }, { id: 2, text: "Second" }, { id: 3, text: "Third" }]);
  return <main>
    <button id="toggle" onClick={() => open.update(x => !x)}>Toggle</button>
    <Presence show={open}>{() => <Motion.p id="notice" animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.05 }}>Notice</Motion.p>}</Presence>
    <ul><PresenceFor each={items} by={x => x.id}>
      {item => <Motion.li id={"row-" + item().id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.2 }}>
        {item().text}
        <button id={"remove-" + item().id} onClick={() => items.update(xs => xs.filter(x => x.id !== item().id))}>Remove</button>
      </Motion.li>}
    </PresenceFor></ul>
  </main>;
}`;
const SERVER = `import { createApp } from "@rivetjs/router/server";
import Page from "./page.tsx";
const entry = {
  routes: [{ id: "p", pattern: "/*rest", page: true, layouts: [] }],
  universal: {}, page: () => () => Page({}),
  document: () => ({ start: "<!doctype html><html><body>", end: "</body></html>" }),
};
export const render = async manifest => (await createApp({ entry, manifest, csp: false })(new Request("http://rivet.test/"))).text();
`;

test("derived PresenceFor: adoption preserves the entrance and the first removal exits", async () => {
  await mkdir(".artifacts", { recursive: true });
  const root = await mkdtemp(resolve(".artifacts/motion-presence-"));
  const browser = await chromium.launch({ headless: true });
  try {
    await mkdir(resolve(root, "src"));
    await writeFile(resolve(root, "src/page.tsx"), PAGE);
    await writeFile(resolve(root, "src/server.tsx"), SERVER);
    await writeFile(resolve(root, "src/app.tsx"), "export default function Root(props) { return <div>{props.children}</div>; }");
    await writeFile(resolve(root, "index.html"), "<!doctype html><p>client</p>");
    const plugin = () =>
      rivet({
        serverExports: { modules: ["src/page.tsx"] },
        resume: { modules: ["src/page.tsx", "src/app.tsx"], roots: ["src/app.tsx"] },
      });
    await build({ root, configFile: false, logLevel: "silent", plugins: [plugin()], build: { outDir: "client-dist", manifest: true } });
    await build({ root, configFile: false, logLevel: "silent", plugins: [plugin()], build: { outDir: "server-dist", ssr: "src/server.tsx" } });
    const manifest = JSON.parse(await readFile(resolve(root, "client-dist/.vite/rivet-resume.json"), "utf8"));
    const { render } = await import(pathToFileURL(resolve(root, "server-dist/server.js")).href);
    const html = await render(manifest);
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", async (route) => {
      const path = new URL(route.request().url()).pathname;
      await route.fulfill({
        contentType: path === "/" ? "text/html" : "text/javascript",
        body: path === "/" ? html : await readFile(resolve(root, "client-dist", "." + path)),
      });
    });
    await page.goto("http://rivet.test/");
    await page.click("#toggle");
    await page.waitForFunction(() => !document.querySelector("#notice"), null, { timeout: 3000 });
    await page.click("#toggle");
    await page.waitForSelector("#notice");
    assert.equal(await page.getAttribute("#row-1", "data-mvv"), "", "server entrance uses custom properties");
    const first = await page.locator("#row-1").elementHandle();
    const second = await page.locator("#row-2").elementHandle();
    const entrances = await page.evaluateHandle(() => {
      const row = document.querySelector("#row-1")!;
      const changes: string[] = [];
      const observer = new MutationObserver((records) => {
        for (const record of records) if (record.oldValue !== null || row.hasAttribute("data-mve")) changes.push("client entrance");
      });
      observer.observe(row, { attributes: true, attributeFilter: ["data-mve"], attributeOldValue: true });
      return { changes, observer };
    });
    await page.click("#remove-1");
    await page.waitForFunction(() => document.querySelector("#row-1")?.hasAttribute("data-exiting"), null, { timeout: 2000 });
    assert.equal(await first!.evaluate((el) => el === document.querySelector("#row-1")), true, "exit keeps the server row");
    await page.waitForFunction(() => !document.querySelector("#row-1"), null, { timeout: 3000 }).catch(() => {});
    assert.deepEqual(errors, []);
    assert.deepEqual(
      await entrances.evaluate(({ changes, observer }) => {
        observer.disconnect();
        return changes;
      }),
      [],
      "adoption must not restart the server entrance",
    );
    assert.equal(await page.locator("#row-1").count(), 0, "the completed exit removes the adopted row");

    assert.equal(await second!.evaluate((el) => el === document.querySelector("#row-2")), true, "surviving server row stays");
    await page.click("#remove-2");
    await page.waitForFunction(() => !document.querySelector("#row-2"), null, { timeout: 3000 });
  } finally {
    await browser.close();
    await rm(root, { recursive: true, force: true });
  }
}, 60_000);
