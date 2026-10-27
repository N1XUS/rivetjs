// Dev server (`vite serve` + `rivetRouter({ bridges: [react()] })`, @vitejs/plugin-react installed): React islands on
// server-rendered dev pages start like production (lane BRIDGE-FIX E2). E2a: an island with plain JSON props boots
// from the lean record, which needs the dev manifest's `islands` (key → dev client module). E2b: an island the
// boundary's adopt run hydrates (live prop + callback) loads its plugin-react-compiled module, which throws "can't
// detect preamble" unless the page loaded the Fast Refresh preamble (SSR pages never run `transformIndexHtml`).
import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright";
import { rivetRouter } from "@rivetjs/router/vite";
import { nodeEnv } from "../../router/tests/vite-env.ts";
import { react } from "../vite.ts";

const files: Record<string, string> = {
  "src/document.ts": `import type { DocumentShell } from "@rivetjs/router/server";
import { headTags } from "@rivetjs/router/server";
const document: DocumentShell = (input) => ({ start: "<!doctype html><html><head>" + headTags(input.head, input) + "</head><body>", end: "</body></html>" });
export default document;
`,
  "src/Counter.react.tsx": `import { useState } from "react";
export function Counter(props: { start: number; onBump?: (n: number) => void; total?: number }) {
  const [n, setN] = useState(props.start);
  return <div><output className="n">{n}</output><output className="total">{props.total ?? ""}</output><button className="inc" onClick={() => (setN(n + 1), props.onBump?.(n + 1))}>+1</button></div>;
}
`,
  "src/routes/index.tsx": `import { Counter } from "../Counter.react.tsx";
export default function Page() {
  return <main><Counter client="load" start={5} /></main>;
}
`,
  "src/routes/live.tsx": `import { signal } from "@rivetjs/reactivity";
import { Counter } from "../Counter.react.tsx";
export default function Page() {
  const total = signal(0);
  return <main><p class="rivet">{total()}</p><Counter client="load" start={1} total={total()} onBump={(n: number) => total.set(n)} /></main>;
}
`,
};

test("dev SSR pages: a JSON-prop React island boots lean, a live / callback island loads with the Fast Refresh preamble", { timeout: 90_000 }, async () => {
  const restore = nodeEnv("development");
  await mkdir(".artifacts", { recursive: true });
  const root = await mkdtemp(resolve(".artifacts/bridge-react-dev-"));
  for (const [file, text] of Object.entries(files)) {
    await mkdir(resolve(root, file, ".."), { recursive: true });
    await writeFile(resolve(root, file), text);
  }
  const server = await createServer({
    configFile: false,
    root,
    logLevel: "silent",
    cacheDir: resolve(root, ".vite"),
    plugins: [rivetRouter({ bridges: [react()] })],
    server: { port: 0 },
  });
  await server.listen();
  const browser = await chromium.launch({ headless: true });
  try {
    const origin = server.resolvedUrls!.local[0]!.replace(/\/$/, "");
    const html = await (await fetch(origin + "/live")).text();
    assert.ok(html.includes("@id/@vitejs/plugin-react/preamble"), "preamble script on the dev page");
    for (const [path, done] of [
      ["/", async (page: import("playwright").Page) => page.locator(".n", { hasText: "6" }).waitFor({ timeout: 10_000 })],
      ["/live", async (page: import("playwright").Page) => page.locator("p.rivet", { hasText: "2" }).waitFor({ timeout: 10_000 })],
    ] as const) {
      const page = await browser.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
      await page.goto(origin + path);
      // Hydrated: React state moves on a click (a static island would not react).
      for (
        let i = 0;
        i < 20 && !(await page.evaluate(() => Object.keys(document.querySelector("rivet-island button") ?? {}).some((k) => k.startsWith("__react"))));
        i++
      )
        await page.waitForTimeout(250);
      await page.click("rivet-island button.inc");
      await done(page);
      assert.deepEqual(errors, [], path);
      await page.close();
    }
  } finally {
    await browser.close();
    await server.close();
    await rm(root, { recursive: true, force: true });
    restore();
  }
});
