// Production docs pages must retain their previews when an idle effect adopts the app, and on client navigation.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser } from "playwright";
import { build } from "vite";
import { afterAll, beforeAll, test } from "vitest";
import { start } from "../../router/adapters/node.ts";
import { generateContent } from "../tools/content/generate.ts";
import type { ExampleData } from "../components/types.ts";

const repo = fileURLToPath(new URL("../../../", import.meta.url));
let temp: string;
let app: Awaited<ReturnType<typeof start>>;
let browser: Browser;

beforeAll(async () => {
  temp = await mkdtemp(join(tmpdir(), "docs-example-resume-"));
  const root = join(temp, "apps/site");
  const write = async (path: string, source: string) => {
    const file = join(root, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, source);
  };
  await symlink(resolve(repo, "node_modules"), join(temp, "node_modules"), "dir");
  await symlink(resolve(repo, "templates"), join(temp, "templates"), "dir");
  await write("package.json", '{"type":"module"}');
  await write(
    "site.config.ts",
    `export const site = { name: "Examples", tagline: "", origin: "http://localhost", repo: "", repoRef: "main", packageVersion: "experimental", version: "0" };`,
  );
  await write(
    "content/_nav.ts",
    `export const areas = [{ id: "start", title: "Start" }];
export const nav = [{ id: "start", title: "Start", area: "start", groups: [{ title: "Basics", pages: ["start/live", "start/code"] }] }];`,
  );
  const examples: Record<string, ExampleData> = {
    live: {
      id: "live",
      title: "Live preview",
      summary: "A working example.",
      tags: [],
      status: "stable",
      height: 96,
      phone: false,
      files: [{ path: "demo.ts", text: "const answer = 42;" }],
      usedOn: [],
    },
    code: {
      id: "code",
      title: "Server example",
      summary: "Code only.",
      tags: [],
      status: "stable",
      height: 96,
      phone: false,
      codeOnly: "needs a server",
      files: [{ path: "server.ts", text: "const server = true;" }],
      usedOn: [],
    },
    unused: {
      id: "unused",
      title: "Unused",
      summary: "Not embedded.",
      tags: [],
      status: "stable",
      height: 96,
      phone: false,
      files: [{ path: "secret.ts", text: "unrelated-example-source-sentinel" }],
      usedOn: [],
    },
  };
  await write("src/generated/examples.json", JSON.stringify(examples));
  for (const id of Object.keys(examples)) await write(`examples/${id}/example.ts`, "export default {};");
  for (const id of ["live", "code"]) await write(`content/start/${id}.md`, `---\ntitle: ${id}\ndescription: An example page.\n---\n\n::example{id=${id}}\n`);
  await generateContent(root);
  // Keep the shared example pages, but use a plain static frame instead of building an example app.
  for (const path of ["src/routes/api", "src/routes/search.tsx", "src/routes/examples/[id]"]) await rm(join(root, path), { recursive: true, force: true });
  await write(
    "src/routes/examples/[id]/frame/index.ts",
    `import { onGet } from "@rivetjs/router";
export const get = onGet(() => new Response("<!doctype html><html><body>Frame loaded</body></html>", { headers: { "content-type": "text/html" } }));`,
  );
  await write("src/document.ts", `export default () => ({ start: '<!doctype html><html><head></head><body>', end: '</body></html>' });`);
  await write(
    "src/routes/_layout.tsx",
    `import { clientEffect } from "@rivetjs/runtime/dom";
import type { LayoutProps } from "@rivetjs/router";
export default function Layout({ children }: LayoutProps) {
  clientEffect(() => { document.documentElement.dataset.adopted = "yes"; }, { when: "idle" });
  return <div><nav><a id="live" href="/start/live/">Live</a><a id="code" href="/start/code/">Code</a></nav>{children}</div>;
}`,
  );
  await write(
    "vite.config.ts",
    `import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";
import { docsSite } from "@rivetjs/docs-kit/vite.ts";
export default defineConfig({ plugins: [docsSite().find(p => p.name === "rivet-docs-modules"), rivetRouter({ clientRouter: true })], logLevel: "silent" });`,
  );
  const config = { root, configFile: join(root, "vite.config.ts"), logLevel: "silent" as const };
  await build(config);
  await build({ ...config, build: { ssr: true } });
  app = await start({ dist: join(root, "dist"), port: 0 });
  browser = await chromium.launch({ headless: true, args: ["--use-mock-keychain", "--password-store=basic"] });
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await app?.close();
  if (temp) await rm(temp, { recursive: true, force: true });
});

test("a loaded iframe and its source survive idle adoption", async () => {
  const html = await (await fetch(app.url + "/start/live/")).text();
  assert.match(html, /<iframe/);
  assert.ok(!html.includes("unrelated-example-source-sentinel"), "only this page's examples travel with it");
  // ZERO Z9: the page's examples are a module of the page chunk, not route data in the resume tail.
  const tail = /<script type="rivet\/boundaries"[^>]*>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "";
  assert.ok(tail.length > 0 && !tail.includes("const answer"), "example source stays out of the route payload");
  const assets = join(temp, "apps/site/dist/client/assets");
  const chunks = await Promise.all((await readdir(assets)).filter((f) => f.endsWith(".js")).map((f) => readFile(join(assets, f), "utf8")));
  assert.ok(
    chunks.some((code) => code.includes("const answer = 42")),
    "the page chunk carries its example",
  );
  assert.ok(!chunks.some((code) => code.includes("unrelated-example-source-sentinel")), "no other example reaches the client");
  const page = await browser.newPage();
  try {
    await page.goto(app.url + "/start/live/");
    await page.waitForSelector("html[data-adopted=yes]", { timeout: 10_000 });
    assert.equal(await page.locator('[aria-label="Example missing"]').count(), 0);
    assert.equal(await page.locator("figure.example iframe").count(), 1);
    assert.match((await page.locator(".code-panel").first().textContent()) ?? "", /const answer = 42/);
    assert.equal(await page.frameLocator("iframe").locator("body").textContent(), "Frame loaded");
  } finally {
    await page.close();
  }
});

test("client navigation renders live and code-only examples using the destination's data", async () => {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(app.url + "/start/live/");
    await page.waitForSelector("html[data-adopted=yes]", { timeout: 10_000 });
    await page.evaluate(() => {
      (window as unknown as { kept: boolean }).kept = true;
    });
    for (const [id, title, frames] of [
      ["code", "Server example", 0],
      ["live", "Live preview", 1],
    ] as const) {
      await page.click("#" + id);
      await page.waitForURL(app.url + `/start/${id}/`);
      await page.waitForFunction((text) => document.querySelector(".example-title")?.textContent === text, title, { timeout: 5000 });
      assert.equal(await page.locator("iframe").count(), frames);
      assert.equal(await page.locator('[aria-label="Example missing"]').count(), 0);
      assert.equal(await page.evaluate(() => (window as unknown as { kept: boolean }).kept), true);
    }
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});

test("the standalone example and gallery survive idle adoption; the gallery carries no source files", async () => {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(app.url + "/examples/live/");
    await page.waitForSelector("html[data-adopted=yes]", { timeout: 10_000 });
    assert.equal(await page.locator("h1").textContent(), "Live preview");
    assert.equal(await page.locator("figure.example iframe").count(), 1);
    assert.equal(await page.locator('[aria-label="Example missing"]').count(), 0);
    const gallery = await (await fetch(app.url + "/examples/")).text();
    assert.ok(!gallery.includes("unrelated-example-source-sentinel"), "gallery payload excludes source files");
    await page.goto(app.url + "/examples/");
    await page.waitForSelector("html[data-adopted=yes]", { timeout: 10_000 });
    assert.equal(await page.locator(".example-gallery > li").count(), 3);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});
