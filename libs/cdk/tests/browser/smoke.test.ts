// Harness smoke test: TS and Rivet TSX modules load in Chromium.
import { test, afterAll as after, beforeAll as before } from "vitest";
import assert from "node:assert/strict";
import { harness, type Harness } from "./harness.ts";

let h: Harness;
before(async () => (h = await harness()));
after(() => h.close());

test("harness: imports TS and Rivet TSX in the browser", async () => {
  const page = await h.blank();
  const dir = await page.evaluate(async () => {
    const bidi = await import("/bidi/index.ts");
    document.documentElement.dir = "rtl";
    return bidi.direction(document.body);
  });
  assert.equal(dir, "rtl");
  const html = await page.evaluate(async () => {
    const { mount } = await import("/tests/browser/deps.ts");
    const { Announcer } = await import("/announcer/index.tsx");
    mount(() => Announcer({}), document.getElementById("root")!);
    return document.getElementById("root")!.innerHTML;
  });
  assert.match(html, /data-rv-announcer="polite"/);
  await page.context().close();
});
