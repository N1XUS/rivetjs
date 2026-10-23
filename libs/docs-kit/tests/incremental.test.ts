// Incremental prerender helpers (tools/incremental.ts): old → new asset names through the Vite
// manifests, rewritten pages with recomputed CSP hashes.
import { strict as assert } from "node:assert";
import { test } from "vitest";
import { hashCSP } from "@rivetjs/router/static";
import { assetRefs, renameMap, rewritePage, stableKey } from "../tools/incremental.ts";

test("stableKey: shared chunk keys lose their hash, source keys stay", () => {
  assert.equal(stableKey("_dom-Bi2CtnTl.js"), "_dom.js");
  assert.equal(stableKey("_dialog-t-_heARy.js"), "_dialog.js");
  assert.equal(stableKey("src/routes/(docs)/components/menu.tsx"), "src/routes/(docs)/components/menu.tsx");
});

test("renameMap: changed outputs map old → new; unchanged and ambiguous ones are left out", () => {
  const previous = {
    "src/routes/a.tsx": { file: "assets/a-AAAAAAAA.js", css: ["assets/a-CCCCCCCC.css"] },
    "src/routes/b.tsx": { file: "assets/b-BBBBBBBB.js" },
    "_dom-DDDDDDDD.js": { file: "assets/dom-DDDDDDDD.js" },
    "_x-11111111.js": { file: "assets/x-11111111.js" },
    "_x-22222222.js": { file: "assets/x-22222222.js" },
  };
  const next = {
    "src/routes/a.tsx": { file: "assets/a-aaaaaaaa.js", css: ["assets/a-cccccccc.css"] },
    "src/routes/b.tsx": { file: "assets/b-BBBBBBBB.js" },
    "_dom-dddddddd.js": { file: "assets/dom-dddddddd.js" },
    "_x-33333333.js": { file: "assets/x-33333333.js" },
  };
  assert.deepEqual([...renameMap(previous, next)].sort(), [
    ["assets/a-AAAAAAAA.js", "assets/a-aaaaaaaa.js"],
    ["assets/a-CCCCCCCC.css", "assets/a-cccccccc.css"],
    ["assets/dom-DDDDDDDD.js", "assets/dom-dddddddd.js"],
  ]);
});

test("rewritePage: asset names replaced everywhere, CSP recomputed for the new inline scripts", () => {
  const map = new Map([["assets/a-AAAAAAAA.js", "assets/a-aaaaaaaa.js"]]);
  const render = (asset: string) =>
    hashCSP(
      `<html><head><title>x</title><script>import("/${asset}")</script></head><body><script type="rivet/boundaries" data-fo="/${asset}">{"m":{"A":"/${asset}"}}</script></body></html>`,
    );
  const before = render("assets/a-AAAAAAAA.js");
  const after = rewritePage(before, map, true);
  assert.equal(after, render("assets/a-aaaaaaaa.js"));
  assert.deepEqual(assetRefs(after), ["/assets/a-aaaaaaaa.js", "/assets/a-aaaaaaaa.js", "/assets/a-aaaaaaaa.js"]);
  // Nothing to rename: unchanged (same string).
  assert.equal(rewritePage(before, new Map(), true), before);
  assert.equal(rewritePage('{"u":"/assets/a-AAAAAAAA.js"}', map, false), '{"u":"/assets/a-aaaaaaaa.js"}');
  // Another origin's assets (an example's own build, shown in its Server HTML tab) are left alone.
  assert.deepEqual(assetRefs('<link href="/menu-css/assets/a-AAAAAAAA.js"> src=&quot;/assets/a-AAAAAAAA.js'), ["/assets/a-AAAAAAAA.js"]);
  // The resume manifest hash moves with the build.
  assert.equal(
    rewritePage('{"v":1,"h":"old","rt":"/assets/a-AAAAAAAA.js"}', map, false, { from: "old", to: "new" }),
    '{"v":1,"h":"new","rt":"/assets/a-aaaaaaaa.js"}',
  );
});
