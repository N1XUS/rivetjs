// Dev pages load the DevTools agent first (before `@vite/client` and the dev entry), and
// `rivetRouter({ devtools: false })` forwards the opt-out to the compiler plugin.
import { test } from "vitest";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { rivetRouter } from "../build/vite.ts";

const root = new URL("./fixture/", import.meta.url).pathname;

async function page(devtools?: boolean): Promise<string> {
  const server = await createServer({
    root,
    configFile: false,
    logLevel: "silent",
    plugins: [rivetRouter({ styles: ["src/styles.css"], ...(devtools === undefined ? {} : { devtools }) })],
    server: { port: 0 },
  });
  await server.listen();
  try {
    return await (await fetch(server.resolvedUrls!.local[0]!.replace(/\/$/, "") + "/items/1")).text();
  } finally {
    await server.close();
  }
}

test("dev page: the DevTools agent is the first script", async () => {
  assert.match(
    await page(),
    /<script type="module" src="\/@id\/@rivetjs\/devtools\/agent" nonce="[^"]+"><\/script><script type="module" src="\/@vite\/client" nonce="[^"]+"><\/script><script type="module" src="\/\.rivet\/entry\.dev\.tsx"/,
  );
});

test("rivetRouter({ devtools: false }): no agent", async () => {
  const html = await page(false);
  assert.doesNotMatch(html, /devtools/);
  assert.match(html, /<script type="module" src="\/@vite\/client" nonce="[^"]+"><\/script><script type="module" src="\/\.rivet\/entry\.dev\.tsx"/);
});
