// LivePageProps is an accessor contract even when the app only uses native links: programmatic navigation
// must not be required for its production document to render.
import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { build } from "vite";
import { chromium, type Browser } from "playwright";
import { rivetRouter } from "../build/vite.ts";
import { start } from "../adapters/node.ts";
import { withNodeEnv } from "./vite-env.ts";

test.each([false, true])(
  "production live-page data stays callable with native links (navigate=%s)",
  async (navigate) => {
    await mkdir(".artifacts", { recursive: true });
    const root = await mkdtemp(resolve(".artifacts/live-native-"));
    let app: Awaited<ReturnType<typeof start>> | undefined;
    let browser: Browser | undefined;
    try {
      await mkdir(join(root, "src/routes"), { recursive: true });
      await writeFile(join(root, "package.json"), '{"type":"module"}');
      await writeFile(join(root, "tsconfig.json"), '{"extends":"../../tsconfig.base.json","include":["src"]}');
      await writeFile(join(root, "src/document.ts"), `export default () => ({ start: "<!doctype html><html><head></head><body>", end: "</body></html>" });`);
      await writeFile(
        join(root, "src/routes/live.tsx"),
        `import { load, type LivePageProps, type RequestEvent } from "@rivetjs/router";
import { signal } from "@rivetjs/reactivity";
export const loader = load(({ url }: RequestEvent) => ({ page: Number(url.searchParams.get("page") ?? "1") }));
export const live = true;
export default function Live({ data }: LivePageProps<typeof loader>) {
  const draft = signal("");
  return <main><input aria-label="Draft" model:value={draft} /><output id="draft">{draft()}</output><output id="page">{data().page}</output><a href="/live?page=7">Next</a></main>;
}`,
      );
      const config = () => ({ root, configFile: false as const, plugins: rivetRouter({ navigate }), logLevel: "silent" as const });
      await withNodeEnv("production", () => build(config()));
      await withNodeEnv("production", () => build({ ...config(), build: { ssr: true } }));
      const errors: string[] = [];
      app = await start({ dist: join(root, "dist"), port: 0, onError: (error) => errors.push(String(error)) });
      for (const page of [1, 7]) {
        const response: Response = await fetch(app.url + "/live?page=" + page);
        const html = (await response.text()).replace(/<!--.*?-->/gs, "");
        assert.equal(response.status, 200, errors.join("\n"));
        assert.match(html, new RegExp(`<output id="page">${page}</output>`));
        assert.match(html, /<a href="\/live\?page=7">Next<\/a>/);
      }
      assert.deepEqual(errors, []);
      browser = await chromium.launch({ headless: true, args: ["--use-mock-keychain", "--password-store=basic"] });
      const page = await browser.newPage();
      const clientErrors: string[] = [];
      page.on("pageerror", (error) => clientErrors.push(error.message));
      await page.goto(app.url + "/live?page=1");
      await page.getByRole("textbox", { name: "Draft" }).fill("keep me");
      await page.waitForFunction(() => document.getElementById("draft")?.textContent === "keep me");
      await page.evaluate(() => ((document.getElementById("page") as HTMLElement & { __kept?: boolean }).__kept = true));
      await page.getByRole("link", { name: "Next" }).click();
      await page.waitForFunction(() => document.getElementById("page")?.textContent === "7");
      assert.equal(await page.getByRole("textbox", { name: "Draft" }).inputValue(), "keep me");
      assert.equal(await page.locator("#draft").textContent(), "keep me");
      assert.equal(await page.locator("#page").evaluate((node) => (node as HTMLElement & { __kept?: boolean }).__kept), true);
      assert.deepEqual(clientErrors, []);
    } finally {
      await browser?.close();
      await app?.close();
      await rm(root, { recursive: true, force: true });
    }
  },
  120_000,
);
