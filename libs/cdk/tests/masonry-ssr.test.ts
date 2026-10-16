// Server rendering (resume mode) of the Rivet-authored `@rivetjs/cdk/masonry`: exact masonry placement as inline CSS
// (one breakpoint = plain calc over the column width; several = masked max() terms, grid custom properties), measured
// mode first paint (CSS columns at the final column width), Bento packed tiles with aria indices, list semantics, the
// virtualized first window, and the whole tree serializes (every capture is resumable: render throws otherwise).
import { describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getImage } from "@rivetjs/compiler/images";
import type { ImageDescriptor } from "@rivetjs/runtime/image";
import { importModule, renderHtml } from "./server.ts";

const source = `
import { Masonry, Bento } from "@rivetjs/cdk/masonry";
import { signal } from "@rivetjs/reactivity";

const photos = [
  { id: "a", width: 400, height: 300 },
  { id: "b", width: 300, height: 600 },
  { id: "c", width: 500, height: 500 },
  { id: "d", width: 800, height: 400 },
];

export function Exact() {
  const selected = signal(new Set(["b"]));
  return (
    <Masonry items={photos} columns={2} gap={10} aria-label="Photos" selectionMode="multiple" selectedKeys={selected} onAction={(k) => console.info(k)}>
      {(photo, state) => <span class="p">{photo.id}:{state.isSelected() ? "on" : "off"}</span>}
    </Masonry>
  );
}

export function Responsive() {
  return (
    <Masonry items={photos} gap={[8, 12]} aria-label="Photos" extraItemHeight={20}>
      {(photo) => <b>{photo.id}</b>}
    </Masonry>
  );
}

export function Measured() {
  const items = signal([{ id: 1, text: "one" }, { id: 2, text: "two" }]);
  return (
    <Masonry items={items} columns={{ 0: 1, 600: 2 }} aria-label="Notes" semantics="list" renderLoader={() => <i>Loading</i>} isLoading={true} onLoadMore={() => console.info("more")}>
      {(note) => <p>{note.text}</p>}
    </Masonry>
  );
}

const tiles = [
  { id: "t1", colSpan: 2, rowSpan: 2 },
  { id: "t2" },
  { id: "t3" },
  { id: "t4", colSpan: 3 },
  { id: "t5" },
];

export function Tiles() {
  return (
    <Bento items={tiles} columns={3} rowHeight={100} gap={10} aria-label="Dashboard" selectionMode="single">
      {(tile) => <div>{tile.id}</div>}
    </Bento>
  );
}

export function TilesAuto() {
  return (
    <Bento items={tiles} columns={{ 0: 2, 800: 4 }} rowHeight="auto" aria-label="Features">
      {(tile) => <div>{tile.id}</div>}
    </Bento>
  );
}

const thousand = Array.from({ length: 1000 }, (_, i) => ({ id: i, aspectRatio: 0.5 + (i % 7) / 4 }));
export function Thousand() {
  return (
    <Masonry items={thousand} gap={8} aria-label="Thousand">
      {(item) => <em>{String(item.id)}</em>}
    </Masonry>
  );
}
export function PlainThousand() {
  return (
    <div role="grid">
      {thousand.map((item) => <div role="row" data-key={item.id}><div role="gridcell"><em>{String(item.id)}</em></div></div>)}
    </div>
  );
}

export function Gallery(p) {
  return (
    <Masonry items={p.images} getKey={(image) => image.src} columns={{ 0: 2, 600: 3 }} gap={{ 0: 6, 600: 12 }} aria-label="Gallery">
      {(image) => <img src={image.src} width={image.width} height={image.height} alt="" />}
    </Masonry>
  );
}

const grow = [
  { id: "a", width: 400, height: 300 },
  { id: "b", width: 300, height: 600 },
  { id: "c", width: 500, height: 500 },
  { id: "d", width: 800, height: 400 },
];
export function Expanded() {
  const open = signal("a");
  return (
    <Masonry items={grow} columns={3} gap={10} aria-label="Grow" getSpan={(item) => () => (open() === item.id ? 2 : 1)}>
      {(item) => <b>{item.id}</b>}
    </Masonry>
  );
}

export function JustifiedThousand() {
  return (
    <Masonry items={thousand} layout="justified" rowHeight={{ 0: 160, 800: 220 }} gap={8} aria-label="Rows">
      {(item) => <em>{String(item.id)}</em>}
    </Masonry>
  );
}

const unsized = [
  { id: "u1", width: 400, height: 300 },
  { id: "u2" },
  { id: "u3", width: 300, height: 600 },
];
export function JustifiedUnsized() {
  return (
    <Masonry items={unsized} layout="justified" rowHeight={100} gap={4} aria-label="Unsized rows">
      {(item) => <em>{item.id}</em>}
    </Masonry>
  );
}
export function ExactUnsized() {
  return (
    <Masonry items={unsized} layout="exact" columns={2} gap={4} aria-label="Unsized grid">
      {(item) => <em>{item.id}</em>}
    </Masonry>
  );
}

const many = Array.from({ length: 2000 }, (_, i) => ({ id: i, aspectRatio: 0.5 + (i % 7) / 4 }));
export function Virtual() {
  return (
    <Masonry items={many} columns={4} gap={8} virtualize height={400} initialSize={{ width: 800, height: 400 }} aria-label="Many">
      {(item) => <em>{String(item.id)}</em>}
    </Masonry>
  );
}
`;

type Fixture = Record<
  | "Exact"
  | "Responsive"
  | "Measured"
  | "Tiles"
  | "TilesAuto"
  | "Virtual"
  | "Thousand"
  | "PlainThousand"
  | "Expanded"
  | "JustifiedThousand"
  | "JustifiedUnsized"
  | "ExactUnsized",
  () => unknown
> & {
  Gallery: (p: { images: readonly ImageDescriptor[] }) => unknown;
};
const load = () => importModule<Fixture>("masonry-ssr-fixture.tsx", source);
const items = (html: string) => [...html.matchAll(/<div[^>]*data-rv-item=""[^>]*>/g)].map((m) => m[0]);
const styleOf = (tag: string) => /style="([^"]*)"/.exec(tag)?.[1] ?? "";

describe("Masonry SSR", () => {
  it("items without a size are measured in the browser (justified: hidden until placed; exact: like auto), never a square", async () => {
    const { JustifiedUnsized, ExactUnsized } = await load();
    const rows = await renderHtml(() => JustifiedUnsized());
    const [r1, r2, r3] = items(rows);
    expect(styleOf(r1!)).toMatch(/aspect-ratio:1.3333/);
    // u2 and the items behind it wait for the measured ratio in a provisional row of hidden 1:1 placeholders below the
    // placed prefix (side by side, never stacked at 0,0); the grid height includes that row, its inline overflow clips.
    expect(styleOf(r2!)).toMatch(/top:var\(--rv-pt\);inset-inline-start:0px;width:var\(--rv-pr\);box-sizing:border-box;visibility:hidden/);
    expect(styleOf(r3!)).toMatch(/inset-inline-start:calc\(1 \* var\(--rv-pa\)\)/);
    expect(styleOf(r3!)).toMatch(/visibility:hidden/);
    const host = /<div[^>]*role="grid"[^>]*>/.exec(rows)![0];
    expect(host).toMatch(/--rv-pt:calc\(/);
    expect(host).toMatch(/--rv-pr:\d+px/);
    expect(host).toMatch(/overflow-x:clip/);
    expect(host).toMatch(/height:calc\(var\(--rv-pt\) \+ var\(--rv-pr\)\)/);
    // The known leading run is server-placed, the rest measured (mixed): no square, no zero-height box (dev builds warn).
    const grid = await renderHtml(() => ExactUnsized());
    expect(grid).toMatch(/data-layout="mixed"/);
    const [, g2] = items(grid);
    expect(styleOf(g2!)).toMatch(/break-inside:avoid/);
    expect(styleOf(g2!)).not.toMatch(/aspect-ratio/);
  });

  it("places known ratios on the server: grid semantics, exact calc() per item, grid height", async () => {
    const { Exact } = await load();
    const html = await renderHtml(() => Exact());
    expect(html).toMatch(/<div[^>]*class="rv-Masonry"[^>]*data-layout="exact"/);
    expect(html).toMatch(/container-type:inline-size/);
    const grid = /<div[^>]*role="grid"[^>]*>/.exec(html)![0];
    expect(grid).toMatch(/aria-label="Photos"/);
    expect(grid).toMatch(/aria-multiselectable="true"/);
    expect(grid).toMatch(/tabindex="0"/);
    expect(grid).toMatch(/--rv-w0:calc\(\(100cqw - 10px\) \/ 2\)/);
    expect(grid).toMatch(/--rv-mw:var\(--rv-w0\)/);
    const [a, b, c, d] = items(html);
    // a → col 0 top 0; b → col 1 top 0; c → col 0 (0.75w + 10 < 2w + 10) under a; d → col 0 under c.
    expect(styleOf(a!)).toMatch(/top:0px;inset-inline-start:0px;width:var\(--rv-mw\);aspect-ratio:1.3333/);
    expect(styleOf(b!)).toMatch(/top:0px;inset-inline-start:calc\(var\(--rv-w0\) \+ 10px\)/);
    expect(styleOf(c!)).toMatch(/top:calc\(0.75 \* var\(--rv-w0\) \+ 10px\);inset-inline-start:0px/);
    expect(styleOf(d!)).toMatch(/top:calc\(1.75 \* var\(--rv-w0\) \+ 20px\)/);
    // Column bottoms 2.25w + 20 and 2w: the shorter is dominated at every width (pruned).
    expect(grid).toMatch(/height:calc\(2.25 \* var\(--rv-w0\) \+ 20px\)/);
    expect(b).toMatch(/role="row"/);
    expect(b).toMatch(/aria-selected="true"/);
    expect(a).toMatch(/aria-selected="false"/);
    expect(a).toMatch(/tabindex="-1"/);
    expect(html).toMatch(/role="gridcell"/);
    expect(html).toMatch(/b:(<!--r\d*-->)?on/);
    expect(html).toMatch(/a:(<!--r\d*-->)?off/);
  });

  it("emits masked max() terms per breakpoint (default columns) and caption extra height", async () => {
    const { Responsive } = await load();
    const html = await renderHtml(() => Responsive());
    const grid = /<div[^>]*role="grid"[^>]*>/.exec(html)![0];
    expect(grid).toMatch(/--rv-m0:clamp\(0px, \(100cqw - 640px \+ 0.01px\) \* 1e9, 1e9px\)/);
    expect(grid).toMatch(/--rv-m1:calc\(clamp\(0px, \(640px - 100cqw\) \* 1e9, 1e9px\) \+ clamp\(0px, \(100cqw - 1024px \+ 0.01px\) \* 1e9, 1e9px\)\)/);
    expect(grid).toMatch(/--rv-w2:calc\(\(100cqw - 24px\) \/ 4 - var\(--rv-m2\)\)/);
    expect(grid).toMatch(/--rv-mw:max\(var\(--rv-w0\), var\(--rv-w1\), var\(--rv-w2\)\)/);
    const [, b, c] = items(html);
    expect(styleOf(b!)).toMatch(/inset-inline-start:max\(calc\(var\(--rv-w0\) \+ 8px\), calc\(var\(--rv-w1\) \+ 8px\), calc\(var\(--rv-w2\) \+ 8px\)\)/);
    expect(styleOf(c!)).toMatch(/height:calc\(var\(--rv-mw\) \+ 20px\)/);
    expect(styleOf(c!)).toMatch(/inset-inline-start:max\(0px, calc\(2 \* var\(--rv-w1\) \+ 16px\), calc\(2 \* var\(--rv-w2\) \+ 16px\)\)/);
  });

  it("measured mode: CSS columns at the final column width, list semantics, loader", async () => {
    const { Measured } = await load();
    const html = await renderHtml(() => Measured());
    expect(html).toMatch(/data-layout="measure"/);
    const grid = /<div[^>]*role="list"[^>]*>/.exec(html)![0];
    expect(grid).toMatch(/column-width:calc\(var\(--rv-mw\) - 0.01px\)/);
    expect(grid).not.toMatch(/tabindex/);
    expect(items(html).every((t) => /role="listitem"/.test(t) && /break-inside:avoid/.test(t))).toBe(true);
    expect(items(html)[0]).toMatch(/data-key-type="number"/);
    expect(html).toMatch(/class="rv-Masonry-loader"[^>]*data-loading="true"/);
    expect(html).toMatch(/<i>Loading<\/i>/);
    expect(html).toMatch(/data-load-more=""/);
  });

  it("sizes known → the server lays out: a `?image` gallery (getImage descriptors) is placed in the HTML", async () => {
    const { Gallery } = await load();
    const out = await mkdtemp(join(tmpdir(), "rv-masonry-img-"));
    try {
      const assets = join(import.meta.dirname, "../../../apps/cdk-docs/examples/_assets");
      const images = await Promise.all(
        ["cactus.jpg", "cherries.jpg", "robot-face.jpg", "robot-profile.jpg"].map((f) =>
          getImage(join(assets, f), { outDir: out, directives: { formats: ["jpeg"] } }),
        ),
      );
      const html = await renderHtml(() => Gallery({ images }));
      expect(html).toMatch(/data-layout="exact"/);
      const tags = items(html);
      expect(tags).toHaveLength(4);
      for (const [i, tag] of tags.entries()) {
        expect(styleOf(tag)).toMatch(/position:absolute/);
        // Intrinsic ratio from the descriptor's width / height.
        expect(styleOf(tag)).toContain(`aspect-ratio:${Math.round((images[i]!.width / images[i]!.height) * 1e4) / 1e4}`);
      }
      expect(html).not.toMatch(/column-width/);
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });

  it("live spans: the layout with a span set at render is emitted by the server", async () => {
    const { Expanded } = await load();
    const html = await renderHtml(() => Expanded());
    const [a, b] = items(html);
    // a spans columns 0–1: width 2w + gap; b goes to the free third column.
    expect(styleOf(a!)).toMatch(/width:calc\(2 \* var\(--rv-w0\) \+ 10px\)/);
    expect(styleOf(b!)).toMatch(/inset-inline-start:calc\(2 \* var\(--rv-w0\) \+ 20px\)/);
  });

  it("virtualized: renders the first window only", async () => {
    const { Virtual } = await load();
    const html = await renderHtml(() => Virtual());
    expect(html).toMatch(/data-virtualized="true"/);
    const count = items(html).length;
    expect(count).toBeGreaterThan(8);
    expect(count).toBeLessThan(200);
    expect(html).toMatch(/aria-rowcount="2000"/);
  });
});

describe("Masonry SSR cost", () => {
  it("renders 1,000 placed items (3 breakpoints) — logs the median vs a plain 1,000-row grid", async () => {
    const { Thousand, PlainThousand, JustifiedThousand } = await load();
    const median = async (view: () => unknown) => {
      for (let i = 0; i < 5; i++) await renderHtml(view);
      const runs: number[] = [];
      for (let i = 0; i < 15; i++) {
        const t0 = performance.now();
        await renderHtml(view);
        runs.push(performance.now() - t0);
      }
      return runs.sort((a, b) => a - b)[7]!;
    };
    const masonry = await median(() => Thousand());
    const plain = await median(() => PlainThousand());
    const rows = await median(() => JustifiedThousand());
    console.info(`masonry SSR 1000 items: columns ${masonry.toFixed(2)} ms, justified ${rows.toFixed(2)} ms (plain grid ${plain.toFixed(2)} ms)`);
    expect(items(await renderHtml(() => Thousand())).length).toBe(1000);
    expect(items(await renderHtml(() => JustifiedThousand())).length).toBe(1000);
  });
});

describe("Bento SSR", () => {
  it("packs tiles dense on the server with aria row / column indices", async () => {
    const { Tiles } = await load();
    const html = await renderHtml(() => Tiles());
    expect(html).toMatch(/class="rv-Bento"[^>]*data-layout="dense"/);
    const [t1, t2, t3, t4, t5] = items(html);
    expect(styleOf(t1!)).toMatch(/top:0px;inset-inline-start:0px;width:calc\(2 \* var\(--rv-w0\) \+ 10px\);height:210px/);
    expect(t2).toMatch(/aria-rowindex="1"/);
    expect(styleOf(t2!)).toMatch(/inset-inline-start:calc\(2 \* var\(--rv-w0\) \+ 20px\)/);
    expect(t3).toMatch(/aria-rowindex="2"/);
    expect(t4).toMatch(/aria-rowindex="3"/);
    expect(styleOf(t4!)).toMatch(/top:220px/);
    expect(t5).toMatch(/aria-rowindex="4"/);
    expect(html).toMatch(/aria-colindex="3"/);
  });

  it("rowHeight auto: native CSS grid, spans clamped to the smallest column count", async () => {
    const { TilesAuto } = await load();
    const html = await renderHtml(() => TilesAuto());
    const grid = /<div[^>]*role="grid"[^>]*>/.exec(html)![0];
    expect(grid).toMatch(/display:grid/);
    expect(grid).toMatch(/grid-template-columns:repeat\(auto-fill, minmax\(calc\(var\(--rv-mw\) - 0.01px\), 1fr\)\)/);
    expect(grid).toMatch(/grid-auto-flow:row dense/);
    const [, , , t4] = items(html);
    expect(styleOf(t4!)).toMatch(/grid-column:span 2;grid-row:span 1/);
  });
});
