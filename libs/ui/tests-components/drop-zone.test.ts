// DropZone on a resumed page (`/drop-zone`; Rivet addition, feature set inspired by HeroUI Pro's public Drop Zone docs): no
// drop-zone script before input; a native file drag marks the area as the drop target (first dragenter resumes it), the
// drop adds a row, dragleave clears the state; the Trigger opens the file chooser and the picked files add rows; a row's
// remove trigger deletes it; the disabled area ignores drags; Shift+Tab from the browse button reaches the area's hidden button (focus ring on the area).
import { test, afterAll, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { nonRuntimeScripts, stories, watch, type Stories } from "./harness.ts";

let s: Stories;
beforeAll(async () => (s = await stories()));
afterAll(async () => s?.close());

test("drop zone: nothing before input, then drag / drop, file chooser, remove, disabled, focus", async () => {
  const page = await s.browser.newPage({ viewport: { width: 1000, height: 900 } });
  const seen = watch(page);
  await page.goto(s.origin + "/drop-zone");
  await page.waitForLoadState("networkidle");
  assert.deepEqual(
    nonRuntimeScripts(seen).filter((u) => /drop-zone|drop_zone/i.test(u)),
    [],
  );
  const rows = () => page.evaluate(() => [...document.querySelectorAll("#dz-files [data-slot=drop-zone-file-name]")].map((e) => e.textContent));

  // Native drag of a file from outside the page.
  // A constructed DataTransfer's file items have no file system entry in Chromium (`webkitGetAsEntry()` = null, skipped as
  // Firefox's phantom item): read them through `getAsFile()`.
  await page.evaluate(() => Object.defineProperty(DataTransferItem.prototype, "webkitGetAsEntry", { value: undefined, configurable: true }));
  const dt = await page.evaluateHandle(() => {
    const d = new DataTransfer();
    // Chromium keeps a constructed DataTransfer's effectAllowed at "none": shadow it (a drag from another app reports "all").
    Object.defineProperty(d, "effectAllowed", { value: "all", writable: true });
    Object.defineProperty(d, "dropEffect", { value: "none", writable: true });
    d.items.add(new File(["hello"], "notes.txt", { type: "text/plain" }));
    return d;
  });
  const area = page.locator("#dz [data-slot=drop-zone-area]");
  // The first dragenter resumes the zone; the browser's repeated dragover then enters it.
  await area.dispatchEvent("dragenter", { dataTransfer: dt });
  await page.waitForFunction(
    (d) => {
      document.querySelector("#dz [data-slot=drop-zone-area]")!.dispatchEvent(new DragEvent("dragover", { dataTransfer: d, bubbles: true, cancelable: true }));
      return document.querySelector("#dz [data-slot=drop-zone-area][data-drop-target=true]") !== null;
    },
    dt,
    { polling: 50 },
  );
  await area.dispatchEvent("dragleave", { dataTransfer: dt });
  await page.waitForSelector("#dz [data-slot=drop-zone-area]:not([data-drop-target])");
  await area.dispatchEvent("dragenter", { dataTransfer: dt });
  await area.dispatchEvent("dragover", { dataTransfer: dt });
  await area.dispatchEvent("drop", { dataTransfer: dt });
  await page.waitForFunction(() => document.querySelectorAll("#dz-files li").length === 1);
  assert.deepEqual(await rows(), ["notes.txt"]);
  assert.equal(await page.locator("#dz [data-slot=drop-zone-area]").getAttribute("data-drop-target"), null);
  assert.equal(await page.locator("#dz-files [data-slot=drop-zone-file-format-icon]").textContent(), "TXT");

  // File chooser via the Trigger.
  const chooser = page.waitForEvent("filechooser");
  await page.click("#dz-browse");
  const fc = await chooser;
  assert.ok(fc.isMultiple());
  await fc.setFiles([
    { name: "a.pdf", mimeType: "application/pdf", buffer: Buffer.from("pdf") },
    { name: "b.png", mimeType: "image/png", buffer: Buffer.from("png") },
  ]);
  await page.waitForFunction(() => document.querySelectorAll("#dz-files li").length === 3);
  assert.deepEqual(await rows(), ["notes.txt", "a.pdf", "b.png"]);

  // Remove a row.
  await page.locator("#dz-files li").nth(1).locator("[data-slot=drop-zone-file-remove-trigger]").click();
  await page.waitForFunction(() => document.querySelectorAll("#dz-files li").length === 2);
  assert.deepEqual(await rows(), ["notes.txt", "b.png"]);

  // Disabled area ignores drags.
  const off = page.locator("#dz-off");
  await off.dispatchEvent("dragenter", { dataTransfer: dt });
  await off.dispatchEvent("drop", { dataTransfer: dt });
  await page.waitForTimeout(100);
  assert.equal(await off.getAttribute("data-drop-target"), null);
  assert.equal(await off.getAttribute("data-disabled"), "true");
  assert.equal((await rows()).length, 2);

  // Keyboard focus ring on the area through its hidden button.
  await page.focus("#dz-browse");
  await page.keyboard.press("Shift+Tab");
  await page.waitForSelector("#dz [data-slot=drop-zone-area][data-focus-visible=true]");
  const name = await page.evaluate(() => {
    const b = document.activeElement as HTMLElement;
    return (b.getAttribute("aria-labelledby") ?? "")
      .split(" ")
      .map((id) => (id === b.id ? "" : document.getElementById(id)?.textContent))
      .join("")
      .trim();
  });
  assert.equal(name, "Drag files here or click to browse");
  await page.close();
});
