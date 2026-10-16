import { test } from "vitest";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { chromium } from "playwright";

test("slots page: in-file loader and handler on the server, resumable slots in the browser", async () => {
  // The browser build carries no server code of the route.
  const dir = new URL("../dist/client/assets/", import.meta.url).pathname;
  for (const file of await readdir(dir))
    if (file.endsWith(".js")) assert.doesNotMatch(await readFile(dir + file, "utf8"), /serverLoad|renderedAt:new Date|format=json/, file);

  const { createPlaygroundServer } = await import("../server.ts");
  const { url: origin, close } = await createPlaygroundServer({ port: 0 });
  const browser = await chromium.launch({ headless: true });
  try {
    const json = (await (await fetch(origin + "/slots?format=json")).json()) as { rows: string[] };
    assert.equal(json.rows.length, 3);
    assert.equal(((await (await fetch(origin + "/api/time?zone=CET")).json()) as { zone: string }).zone, "CET");

    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(origin + "/slots");
    await page.getByRole("heading", { name: "Slots in Rivet" }).waitFor();
    await page.getByRole("heading", { name: "Untitled card" }).waitFor();
    await page.getByText("No footer").waitFor();
    // A region in the child renders the parent's scoped slot after resume (no component re-runs).
    await page.getByRole("button", { name: "Show details" }).first().click();
    await page.getByText("1. Lazy slot content (0 likes)").waitFor();
    await page.getByRole("button", { name: "Like (0)" }).click();
    await page.getByText("1. Lazy slot content (1 likes)").waitFor();
    await page.getByRole("button", { name: "Like (1)" }).waitFor();
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await close();
  }
});
