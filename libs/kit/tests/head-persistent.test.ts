import { test } from "vitest";
import assert from "node:assert/strict";
import { Window } from "happy-dom";

test("persistent root meta, link and JSON-LD return after repeated page overrides", async () => {
  const window = new Window({ url: "https://x.test/" });
  const global = globalThis as unknown as Record<string, unknown>;
  const saved = global.document;
  global.document = window.document;
  try {
    const { document } = window;
    document.head.innerHTML =
      '<meta data-rh="0" name="theme-color" content="blue">' +
      '<link data-rh="0" rel="canonical" href="https://x.test/">' +
      '<script data-rh="0" id="org" type="application/ld+json">{"name":"root"}</script>';
    const originals = [...document.head.children];
    const { applyRouteHead } = await import("../dom.ts");
    for (const color of ["red", "green"]) {
      applyRouteHead({
        head: {
          meta: [{ name: "theme-color", content: color }],
          links: [{ rel: "canonical", href: "https://x.test/" + color }],
          scripts: [{ id: "org", jsonLd: { name: color } }],
        },
      });
      await Promise.resolve();
      assert.equal(document.querySelector('meta[name="theme-color"]')!.getAttribute("content"), color);
      applyRouteHead({ head: {} });
      await Promise.resolve();
      assert.equal(document.head.children.length, originals.length, "restore all root tags");
      for (let i = 0; i < originals.length; i++) assert.ok(document.head.children[i] === originals[i], "restore original node " + i);
    }
  } finally {
    global.document = saved;
    await window.happyDOM.close();
  }
});
