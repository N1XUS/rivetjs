// Example frame stylesheets in a client build (`tools/frame-styles.ts`): group sheet kept, component sheets merged.
import { test } from "vitest";
import assert from "node:assert/strict";
import type { Rollup } from "vite";
import { frameStyleLists, mergeFrameStyles } from "../tools/frame-styles.ts";

const chunk = (fileName: string, imports: string[], css: string[], moduleIds: string[] = []): Rollup.OutputChunk =>
  ({ type: "chunk", fileName, imports, moduleIds, viteMetadata: { importedCss: new Set(css), importedAssets: new Set() } }) as unknown as Rollup.OutputChunk;
const asset = (fileName: string, source: string): Rollup.OutputAsset => ({ type: "asset", fileName, source }) as unknown as Rollup.OutputAsset;

function bundle() {
  const group = chunk("assets/group.js", [], ["assets/group.css"], ["/app/src/generated/example-css/abc.css"]);
  const select = chunk("assets/select.js", ["assets/group.js", "assets/list.js"], ["assets/select.css"]);
  const list = chunk("assets/list.js", [], ["assets/list-box.css", "assets/label.css"]);
  const card = chunk("assets/card.js", ["assets/group.js"], ["assets/card.css"]);
  const chunks = [group, select, list, card];
  const out: Rollup.OutputBundle = {};
  for (const c of chunks) out[c.fileName] = c;
  out["assets/group.css"] = asset("assets/group.css", "@layer theme, components;\n.g{}");
  out["assets/select.css"] = asset("assets/select.css", "/*$vite$:1*/\n@layer theme, components;\n.select{}");
  out["assets/list-box.css"] = asset("assets/list-box.css", "@layer theme, components;\n.list-box{}");
  out["assets/label.css"] = asset("assets/label.css", ".label{}");
  out["assets/card.css"] = asset("assets/card.css", ".card{}");
  return {
    out,
    chunks,
    holders: new Map([
      ["select-default", select],
      ["card-default", card],
    ]),
  };
}

test("frame styles: post-order closure per frame, then group sheet + one merged component sheet", () => {
  const { out, chunks, holders } = bundle();
  const lists = frameStyleLists(chunks, holders, "/");
  assert.deepEqual(lists["select-default"], ["/assets/group.css", "/assets/list-box.css", "/assets/label.css", "/assets/select.css"]);
  const isGroup = (c: Rollup.OutputChunk) => c.moduleIds.some((m) => m.includes("/example-css/"));
  const { frames, assets } = mergeFrameStyles(out, lists, "/", isGroup);
  assert.equal(frames["select-default"]!.length, 2);
  assert.equal(frames["select-default"]![0], "/assets/group.css");
  assert.match(frames["select-default"]![1]!, /^\/assets\/frame-[\w-]{8}\.css$/);
  // One component sheet: kept as is (no merged asset for it).
  assert.deepEqual(frames["card-default"], ["/assets/group.css", "/assets/card.css"]);
  assert.equal(assets.length, 1);
  const source = assets[0]!.source;
  // Link order kept, Vite markers dropped, the repeated `@layer` statement once.
  assert.ok(source.indexOf(".list-box{}") < source.indexOf(".label{}") && source.indexOf(".label{}") < source.indexOf(".select{}"));
  assert.doesNotMatch(source, /\$vite\$/);
  assert.equal(source.match(/@layer theme, components;/g)?.length, 1);
});
