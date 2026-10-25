// Example frame pages on the derived resume model (`components/frame.tsx` `FrameRoot`): a page that takes props (loader
// data, layouts) resumes under the frame's independent root boundary, whose props carry the route payload as data (a
// loader's Date through the resume table); a page that takes none keeps its own boundaries top-level (no frame record).
// One frames-only production build of apps/docs (`buildFrames`, as `check-examples`), then Chromium on its output.
import { strict as assert } from "node:assert";
import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { afterAll, beforeAll, test } from "vitest";
import { buildFrames, type FramesBuild } from "../tools/check-examples.ts";
import { CHROMIUM_ARGS, serveClient } from "../tools/example-checks.ts";
import { expandTail } from "@rivetjs/runtime/resume-format";

const app = fileURLToPath(new URL("../../../apps/docs", import.meta.url));
const dist = resolve(app, ".artifacts/frame-root-test");
const ROOT = "@rivetjs/docs-kit/components/frame.tsx#default";
let frames: FramesBuild;

beforeAll(async () => {
  frames = await buildFrames(app, ["loader-data", "nested-layouts", "counter"], { dist, log: () => {} });
}, 240_000);
afterAll(async () => {
  await rm(dist, { recursive: true, force: true });
});

const tail = async (id: string) => {
  const html = await readFile(resolve(frames.build.client, "examples", id, "frame/index.html"), "utf8");
  const json = /<script type="rivet\/boundaries"[^>]*>([^<]*)<\/script>/.exec(html)?.[1];
  assert.ok(json, `${id}: no boundaries tail`);
  return expandTail(JSON.parse(json)) as unknown as { b: [number, number, number, string, unknown[], { s?: unknown }?][] };
};

test("a frame page that takes props resumes under FrameRoot with its payload; one that takes none has no frame record", async () => {
  const loader = await tail("loader-data");
  const root = loader.b.find((record) => record[3] === ROOT);
  assert.ok(root, "loader-data: FrameRoot record");
  assert.equal(root[1], 0, "FrameRoot is top-level");
  assert.ok(root[5]?.s, "FrameRoot carries the payload");
  // The page (its signal) adopts with the root: its parent is the root.
  assert.ok(
    loader.b.some((record) => record[1] === root[0] && record[3].startsWith("examples/loader-data/")),
    "page below FrameRoot",
  );
  assert.ok(
    (await tail("nested-layouts")).b.some((record) => record[3] === ROOT),
    "layouts: FrameRoot record",
  );
  assert.ok(!(await tail("counter")).b.some((record) => record[3] === ROOT), "counter: no FrameRoot record");
});

test("a frame page with loader data (a Date) adopts on its first click", async () => {
  const server = await serveClient(frames.build.client);
  const browser = await chromium.launch({ headless: true, args: CHROMIUM_ARGS });
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    await page.goto(server.url + "/examples/loader-data/frame/", { waitUntil: "load" });
    assert.equal(await page.textContent("#updated"), "Updated 2026-10-01");
    await page.click("#unread");
    await page.waitForFunction(() => document.querySelector("#count")?.textContent === "Showing 2 of 3", null, { timeout: 5000 });
    assert.equal(await page.locator("#books li").count(), 2);
    // The adopt run kept the server nodes: the page's text from the loader's Date is the same node content.
    assert.equal(await page.textContent("#updated"), "Updated 2026-10-01");
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await server.close();
  }
}, 60_000);
