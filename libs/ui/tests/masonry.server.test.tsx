// Server-target suite: `Masonry` / `Bento` SSR (Rivet-authored; HeroUI v3.2.6 / HeroUI Pro have no masonry): BEM classes
// + data-slot over the cdk markup (root / grid / item / loader), placement stays inline (exact calc, Bento spans),
// user classes merged (string + per-item function), slots of the tv variants.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Bento, Masonry, bentoVariants, masonryVariants } from "../src/components/masonry/index.ts";

const photos = [
  { id: "a", aspectRatio: 1 },
  { id: "b", aspectRatio: 0.5 },
  { id: "c", aspectRatio: 2 },
];

test("masonry: slots", () => {
  const m = masonryVariants();
  assert.equal(m.base(), "masonry");
  assert.equal(m.item(), "masonry__item");
  assert.equal(bentoVariants().grid(), "bento__grid");
});

test("masonry SSR: classes over the cdk markup, exact placement inline, loader", async () => {
  const html = await renderToString(() => (
    <Masonry
      items={photos}
      columns={2}
      gap={8}
      aria-label="Photos"
      class="w-full"
      itemClass="shadow-surface"
      isLoading={true}
      renderLoader={() => <i>Loading</i>}
    >
      {(p) => <span>{p.id}</span>}
    </Masonry>
  ));
  assert.match(html, /<div[^>]*class="masonry w-full"[^>]*data-slot="masonry"|<div[^>]*data-slot="masonry"[^>]*class="masonry w-full"/);
  assert.match(html, /data-layout="exact"/);
  assert.match(html, /role="grid"[^>]*class="masonry__grid"|class="masonry__grid"[^>]*role="grid"/);
  assert.equal((html.match(/class="masonry__item shadow-surface"/g) ?? []).length, 3);
  assert.doesNotMatch(html, /rv-Masonry-item/);
  assert.match(html, /--rv-w0:calc\(\(100cqw - 8px\) \/ 2\)/);
  assert.match(html, /class="masonry__loader"[^>]*data-loading="true"/);
});

test("bento SSR: per-item class function, spans packed inline", async () => {
  const tiles = [{ id: "x", colSpan: 2 }, { id: "y" }, { id: "z" }];
  const html = await renderToString(() => (
    <Bento items={tiles} columns={3} rowHeight={120} aria-label="Tiles" itemClass={(state) => (state.key === "x" ? "hero" : undefined)}>
      {(t) => <b>{t.id}</b>}
    </Bento>
  ));
  assert.match(html, /class="bento"/);
  assert.match(html, /data-slot="bento"/);
  assert.match(html, /class="bento__item hero"/);
  assert.equal((html.match(/class="bento__item"/g) ?? []).length, 2);
  assert.match(html, /height:120px/);
  assert.match(html, /aria-colindex="3"/);
});

test("masonry SSR: justified rows, live spans and fit pass through to the cdk", async () => {
  const rows = await renderToString(() => (
    <Masonry items={photos} layout="justified" rowHeight={200} lastRow="left" gap={4} aria-label="Rows">
      {(p) => <span>{p.id}</span>}
    </Masonry>
  ));
  assert.match(rows, /data-layout="justified"/);
  assert.equal((rows.match(/class="masonry__item"[^>]*style="[^"]*position:absolute/g) ?? []).length, 3);
  const grown = await renderToString(() => (
    <Masonry items={photos} columns={3} gap={10} fit="both" getSpan={(p) => (p.id === "a" ? 2 : 1)} aria-label="Grow">
      {(p) => <span>{p.id}</span>}
    </Masonry>
  ));
  assert.match(grown, /width:calc\(2 \* var\(--rv-w0\) \+ 10px\)/);
});
