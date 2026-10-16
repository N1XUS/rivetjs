// Behaviour tests (Chromium, real layout) for the Rivet-authored `@rivetjs/cdk/masonry`: the server-exact inline CSS
// (container-query math, masked breakpoint max()) lands every item on the JS placement at several container widths,
// measured mode places by real heights and relayouts on resize, 2D arrow keys by visual position, selection (click,
// Shift range, Ctrl+A, Escape, Space), actions, list semantics, Bento dense = Chromium's own `grid-auto-flow: dense`,
// load more, and the virtualized 10k mode (window only, keys reach items outside the window).
import { afterEach, describe, expect, it } from "vitest";
import { signal } from "@rivetjs/reactivity";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { Bento, Masonry, type MasonryProps, type Selection } from "../masonry/index.tsx";
import {
  columnWidth,
  masonryRects,
  packBento,
  placeMasonry,
  referenceWidths,
  resolveBreakpoints,
  breakpointAt,
  placeColumns,
  unitRange,
  fitColumns,
  justifiedSplits,
  type Key,
} from "../masonry/layout.ts";
import { extentAt, rectsAt } from "../masonry/geometry.ts";
import { placeJustified } from "../masonry/justified.ts";
import type { MasonryHandle } from "../masonry/behaviour.ts";

afterEach(cleanup);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const until = async (check: () => boolean, ms = 3000) => {
  const end = performance.now() + ms;
  while (!check()) {
    if (performance.now() > end) throw new Error("timed out");
    await sleep(16);
  }
};
const key = (el: Element, k: string, init: KeyboardEventInit = {}) =>
  el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...init }));
const click = (el: Element, init: MouseEventInit = {}) => el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ...init }));

function mount(ui: () => unknown, width = 600): HTMLElement {
  document.body.style.margin = "0";
  const c = render(ui as never).container as HTMLElement;
  (c as HTMLElement).style.width = width + "px";
  return c;
}

interface Photo {
  id: string;
  aspectRatio: number;
}
const photos: Photo[] = Array.from({ length: 24 }, (_, i) => ({ id: `p${i}`, aspectRatio: [1, 0.66, 1.5, 0.8, 1.25, 2, 0.5][i % 7]! }));

const itemsOf = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>("[data-rv-item]")];
const itemByKey = (c: HTMLElement, k: string) => c.querySelector<HTMLElement>(`[data-rv-item][data-key="${k}"]`)!;
const gridOf = (c: HTMLElement) => c.querySelector<HTMLElement>("[data-rv-grid]")!;

function Gallery(props: Partial<MasonryProps<Photo>>) {
  return (
    <Masonry items={photos} aria-label="Photos" gap={10} {...props}>
      {(photo) => <span>{photo.id}</span>}
    </Masonry>
  );
}

describe("Masonry exact placement", () => {
  it("lands every item on the JS placement at each breakpoint (CSS math = layout.ts)", async () => {
    const c = mount(() => <Gallery />);
    const bps = resolveBreakpoints(undefined, undefined, 4, 10);
    const refs = referenceWidths(bps);
    const alpha = photos.map((p) => 1 / p.aspectRatio);
    const beta = photos.map(() => 0);
    for (const width of [360, 639, 640, 800, 1023.5, 1024, 1400]) {
      c.style.width = width + "px";
      await frame();
      const root = c.querySelector<HTMLElement>("[data-rv-masonry]")!;
      const W = root.getBoundingClientRect().width;
      const b = breakpointAt(bps, W);
      const n = bps[b]!.columns;
      const p = placeMasonry(alpha, beta, n, columnWidth(refs[b]!, n, 10), 10);
      const rects = masonryRects(p, alpha, beta, W, 10);
      const origin = root.getBoundingClientRect();
      itemsOf(c).forEach((el, i) => {
        const r = el.getBoundingClientRect();
        expect(Math.abs(r.left - origin.left - rects[i]!.x), `x ${i} @${width}`).toBeLessThan(0.6);
        expect(Math.abs(r.top - origin.top - rects[i]!.y), `y ${i} @${width}`).toBeLessThan(0.6);
        expect(Math.abs(r.width - rects[i]!.width), `w ${i} @${width}`).toBeLessThan(0.6);
        expect(Math.abs(r.height - rects[i]!.height), `h ${i} @${width}`).toBeLessThan(0.6);
      });
      const bottom = Math.max(...rects.map((r) => r.y + r.height));
      expect(Math.abs(gridOf(c).getBoundingClientRect().height - bottom)).toBeLessThan(0.6);
    }
  });

  it("registers the grid custom properties as lengths on the client (computed once on the grid)", async () => {
    const c = mount(() => <Gallery />, 1000);
    await frame();
    const w = getComputedStyle(gridOf(c)).getPropertyValue("--rv-w1").trim();
    expect(w).toMatch(/^-?[\d.e+]+px$/);
    expect(parseFloat(getComputedStyle(gridOf(c)).getPropertyValue("--rv-mw"))).toBeCloseTo((1000 - 20) / 3, 1);
  });

  it("RTL mirrors through logical insets", async () => {
    const c = mount(() => (
      <div dir="rtl">
        <Gallery columns={3} />
      </div>
    ));
    await frame();
    const root = c.querySelector<HTMLElement>("[data-rv-masonry]")!.getBoundingClientRect();
    const first = itemsOf(c)[0]!.getBoundingClientRect();
    expect(Math.abs(first.right - root.right)).toBeLessThan(0.6);
  });

  it("re-places in place when items change (keyed rows kept)", async () => {
    const list = signal(photos.slice(0, 6));
    const c = mount(() => (
      <Masonry items={list} columns={2} gap={0} aria-label="P" motion={false}>
        {(p) => <span>{p.id}</span>}
      </Masonry>
    ));
    await frame();
    const kept = itemByKey(c, "p3");
    list.set([photos[3]!, ...photos.slice(0, 3)]);
    await frame();
    expect(itemByKey(c, "p3")).toBe(kept);
    expect(itemsOf(c).length).toBe(4);
    expect(kept.getBoundingClientRect().top - c.getBoundingClientRect().top).toBeLessThan(0.6);
  });
});

describe("Masonry measured", () => {
  it("first paints CSS columns, then places by real heights and relayouts on resize", async () => {
    const notes = Array.from({ length: 9 }, (_, i) => ({ id: i, lines: 1 + ((i * 5) % 4) }));
    const c = mount(
      () => (
        <Masonry items={notes} columns={{ 0: 2, 700: 3 }} gap={10} aria-label="Notes">
          {(note) => <div style={{ height: `${note.lines * 30}px` }}>{String(note.id)}</div>}
        </Masonry>
      ),
      600,
    );
    const grid = gridOf(c);
    await until(() => grid.hasAttribute("data-measured"));
    const check = () => {
      const W = grid.clientWidth;
      const n = W >= 700 ? 3 : 2;
      const w = (W - (n - 1) * 10) / n;
      const p = placeMasonry(
        new Float64Array(9),
        notes.map((x) => x.lines * 30),
        n,
        w,
        10,
      );
      const origin = grid.getBoundingClientRect();
      itemsOf(c).forEach((el, i) => {
        const r = el.getBoundingClientRect();
        expect(Math.abs(r.left - origin.left - p.col[i]! * (w + 10)), `x ${i}`).toBeLessThan(0.6);
        expect(Math.abs(r.top - origin.top - p.b[i]!), `y ${i}`).toBeLessThan(0.6);
        expect(Math.abs(r.width - w)).toBeLessThan(0.6);
      });
    };
    check();
    c.style.width = "900px";
    // Item widths follow the CSS variables at once; the placement lands one observer frame later.
    await until(() => Math.abs(itemsOf(c)[0]!.getBoundingClientRect().width - (900 - 20) / 3) < 0.6);
    await frame();
    await frame();
    check();
  });

  it("places appended items (one node per item, none left in the flow) and reads no layout while watching", async () => {
    const make = (from: number, n: number) => Array.from({ length: n }, (_, i) => ({ id: from + i, lines: 1 + (((from + i) * 7) % 4) }));
    const list = signal(make(0, 6));
    const c = mount(
      () => (
        <Masonry items={list} columns={3} gap={10} aria-label="Notes" layout="measure">
          {(note) => <div style={{ height: `${note.lines * 30}px` }}>{`note ${note.id}`}</div>}
        </Masonry>
      ),
      600,
    );
    const grid = gridOf(c);
    await until(() => grid.hasAttribute("data-measured"));
    const proto = Element.prototype;
    const original = proto.getBoundingClientRect;
    let reads = 0;
    proto.getBoundingClientRect = function (this: Element) {
      reads++;
      return original.call(this);
    };
    const offset = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight")!;
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get(this: HTMLElement) {
        reads++;
        return offset.get!.call(this);
      },
    });
    try {
      list.set([...list(), ...make(6, 9)]);
      await frame();
      await frame();
      await frame();
      c.style.width = "800px";
      await frame();
      await frame();
      await frame();
    } finally {
      proto.getBoundingClientRect = original;
      Object.defineProperty(HTMLElement.prototype, "offsetHeight", offset);
    }
    expect(reads).toBe(0);
    const items = itemsOf(c);
    expect(items.length).toBe(15);
    for (let i = 0; i < 15; i++) expect(c.querySelectorAll(`[data-key="${i}"]`).length).toBe(1);
    // Every item is placed (absolute, visible, in its greedy column), the grid holds no in-flow item.
    const W = grid.clientWidth;
    const w = (W - 20) / 3;
    const p = placeMasonry(
      new Float64Array(15),
      list().map((x) => x.lines * 30),
      3,
      w,
      10,
    );
    const origin = grid.getBoundingClientRect();
    items.forEach((el, i) => {
      expect(getComputedStyle(el).position).toBe("absolute");
      expect(getComputedStyle(el).visibility).toBe("visible");
      const r = el.getBoundingClientRect();
      expect(Math.abs(r.left - origin.left - p.col[i]! * (w + 10)), `x ${i}`).toBeLessThan(0.6);
      expect(Math.abs(r.top - origin.top - p.b[i]!), `y ${i}`).toBeLessThan(0.6);
      expect(Math.abs(r.width - w), `w ${i}`).toBeLessThan(0.6);
    });
    // No two items overlap.
    const rects = items.map((el) => el.getBoundingClientRect());
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i]!;
        const b = rects[j]!;
        const overlap = Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
        expect(overlap, `${i} / ${j}`).toBe(false);
      }
    // Removing items relayouts the rest.
    list.set(list().slice(5));
    await frame();
    await frame();
    expect(itemsOf(c).length).toBe(10);
    expect(Math.abs(itemsOf(c)[0]!.getBoundingClientRect().top - grid.getBoundingClientRect().top)).toBeLessThan(0.6);
  });

  it("reflows 1,000 measured items within one frame", async () => {
    const notes = Array.from({ length: 1000 }, (_, i) => ({ id: i, h: 40 + ((i * 13) % 7) * 10 }));
    const c = mount(
      () => (
        <Masonry items={notes} columns={4} gap={8} aria-label="Notes" layout="measure">
          {(note) => <div style={{ height: `${note.h}px` }} />}
        </Masonry>
      ),
      1000,
    );
    const grid = gridOf(c);
    await until(() => grid.hasAttribute("data-measured"));
    const { reflowMeasured } = await import("../masonry/behaviour.ts");
    c.style.width = "1200px";
    const t0 = performance.now();
    reflowMeasured(grid, { breakpoints: [{ min: 0, columns: 4, gap: [8, 8] }] });
    const ms = performance.now() - t0;
    console.info(`masonry measured reflow 1000 items: ${ms.toFixed(2)} ms`);
    expect(ms).toBeLessThan(16);
  });
});

describe("Masonry keyboard + selection", () => {
  it("one tab stop; arrows move by visual position; Home / End", async () => {
    const c = mount(() => <Gallery columns={3} />);
    await frame();
    const grid = gridOf(c);
    grid.focus();
    expect(document.activeElement).toBe(itemByKey(c, "p0"));
    expect(grid.tabIndex).toBe(-1);
    expect(itemByKey(c, "p0").getAttribute("data-focus-visible")).toBe("true");
    key(document.activeElement!, "ArrowRight");
    expect(document.activeElement).toBe(itemByKey(c, "p1"));
    // p1 (column 1, tall) overlaps p3 more than p2 in column 2: WaterfallLayout's deltaX − overlapY picks p3.
    key(document.activeElement!, "ArrowRight");
    expect(document.activeElement).toBe(itemByKey(c, "p3"));
    key(document.activeElement!, "ArrowRight");
    expect(document.activeElement).toBe(itemByKey(c, "p3"));
    key(document.activeElement!, "ArrowUp");
    expect(document.activeElement).toBe(itemByKey(c, "p2"));
    // Down = the next item of the same column, visually.
    const below = (el: Element) => {
      const r = el.getBoundingClientRect();
      return itemsOf(c)
        .filter((o) => o !== el && Math.abs(o.getBoundingClientRect().left - r.left) < 1 && o.getBoundingClientRect().top > r.top)
        .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
    };
    const expected = below(itemByKey(c, "p3"));
    key(document.activeElement!, "ArrowDown");
    expect(document.activeElement).toBe(itemByKey(c, "p3"));
    key(document.activeElement!, "ArrowDown");
    expect(document.activeElement).toBe(expected);
    key(document.activeElement!, "End");
    expect(document.activeElement).toBe(itemByKey(c, "p23"));
    key(document.activeElement!, "Home");
    expect(document.activeElement).toBe(itemByKey(c, "p0"));
    (document.activeElement as HTMLElement).blur();
    expect(grid.tabIndex).toBe(0);
  });

  it("multiple selection: click toggles, Shift+click range, Ctrl+A, Escape, Space, disabled keys skipped", async () => {
    const selected = signal<Selection>(new Set());
    const c = mount(() => <Gallery columns={3} selectionMode="multiple" selectedKeys={selected} disabledKeys={["p2"]} />);
    await frame();
    click(itemByKey(c, "p0"));
    expect([...(selected() as Set<Key>)]).toEqual(["p0"]);
    expect(itemByKey(c, "p0").getAttribute("aria-selected")).toBe("true");
    click(itemByKey(c, "p4"), { shiftKey: true });
    expect([...(selected() as Set<Key>)].sort()).toEqual(["p0", "p1", "p3", "p4"]);
    click(itemByKey(c, "p2"));
    expect((selected() as Set<Key>).has("p2")).toBe(false);
    expect(itemByKey(c, "p2").getAttribute("aria-disabled")).toBe("true");
    itemByKey(c, "p0").focus();
    key(itemByKey(c, "p0"), "a", { ctrlKey: true });
    expect(selected()).toBe("all");
    expect(itemByKey(c, "p2").getAttribute("aria-selected")).toBe("false");
    key(itemByKey(c, "p0"), "Escape");
    expect((selected() as Set<Key>).size).toBe(0);
    key(itemByKey(c, "p0"), " ");
    expect([...(selected() as Set<Key>)]).toEqual(["p0"]);
    key(itemByKey(c, "p0"), "ArrowRight", { shiftKey: true });
    expect([...(selected() as Set<Key>)].sort()).toEqual(["p0", "p1"]);
  });

  it("replace behaviour follows the focus; actions on Enter / double click / click when nothing is selectable", async () => {
    const actions: Key[] = [];
    const selected = signal<Selection>(new Set());
    const c = mount(() => <Gallery columns={3} selectionMode="single" selectionBehavior="replace" selectedKeys={selected} onAction={(k) => actions.push(k)} />);
    await frame();
    click(itemByKey(c, "p1"));
    expect([...(selected() as Set<Key>)]).toEqual(["p1"]);
    itemByKey(c, "p1").focus();
    key(itemByKey(c, "p1"), "ArrowRight");
    expect([...(selected() as Set<Key>)]).toEqual(["p3"]);
    key(document.activeElement!, "Enter");
    expect(actions).toEqual(["p3"]);
    itemByKey(c, "p0").dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(actions).toEqual(["p3", "p0"]);
    cleanup();
    const c2 = mount(() => <Gallery columns={3} onAction={(k) => actions.push(k)} />);
    await frame();
    click(itemByKey(c2, "p5"));
    expect(actions.at(-1)).toBe("p5");
    expect(itemByKey(c2, "p5").hasAttribute("aria-selected")).toBe(false);
  });

  it("list semantics: role list, no tab stop, no arrow keys", async () => {
    const c = mount(() => <Gallery columns={2} semantics="list" />);
    await frame();
    expect(gridOf(c).getAttribute("role")).toBe("list");
    expect(gridOf(c).hasAttribute("tabindex")).toBe(false);
    expect(itemsOf(c).every((el) => el.getAttribute("role") === "listitem")).toBe(true);
  });

  it("calls onLoadMore when the end scrolls into view and shows the loader", async () => {
    let calls = 0;
    const loading = signal(false);
    const c = mount(() => (
      <Gallery columns={4} onLoadMore={() => (calls++, loading.set(true))} isLoading={loading} renderLoader={() => <i id="loader">Loading</i>} />
    ));
    await until(() => calls > 0);
    await frame();
    expect(c.querySelector("#loader")!.closest<HTMLElement>(".rv-Masonry-loader")!.hidden).toBe(false);
  });
});

describe("Bento", () => {
  const tiles = [
    { id: "a", colSpan: 2, rowSpan: 2 },
    { id: "b" },
    { id: "c", colSpan: 3 },
    { id: "d" },
    { id: "e", rowSpan: 2 },
    { id: "f", colSpan: 2 },
    { id: "g" },
    { id: "h" },
  ];
  it("dense packing = Chromium's native grid-auto-flow: dense placement", async () => {
    const cs = tiles.map((t) => t.colSpan ?? 1);
    const rs = tiles.map((t) => t.rowSpan ?? 1);
    const host = document.createElement("div");
    host.style.cssText = "display:grid;grid-template-columns:repeat(4,100px);grid-auto-rows:50px;grid-auto-flow:row dense;gap:0;width:400px";
    for (let i = 0; i < tiles.length; i++) {
      const el = document.createElement("div");
      el.style.cssText = `grid-column:span ${cs[i]};grid-row:span ${rs[i]}`;
      host.append(el);
    }
    document.body.append(host);
    const native = [...host.children].map((el) => {
      const r = el.getBoundingClientRect();
      const o = host.getBoundingClientRect();
      return [Math.round((r.top - o.top) / 50), Math.round((r.left - o.left) / 100)];
    });
    host.remove();
    const p = packBento(cs, rs, 4, "dense");
    expect([...p.row].map((r, i) => [r, p.col[i]])).toEqual(native);

    const c = mount(
      () => (
        <Bento items={tiles} columns={4} rowHeight={50} gap={0} aria-label="Tiles">
          {(t) => <span>{t.id}</span>}
        </Bento>
      ),
      400,
    );
    await frame();
    const origin = gridOf(c).getBoundingClientRect();
    const placed = itemsOf(c).map((el) => {
      const r = el.getBoundingClientRect();
      return [Math.round((r.top - origin.top) / 50), Math.round((r.left - origin.left) / 100)];
    });
    expect(placed).toEqual(native);
    expect(itemByKey(c, "c").getAttribute("aria-rowindex")).toBe(String(p.row[2]! + 1));
  });

  it("navigates spans by visual position", async () => {
    const c = mount(
      () => (
        <Bento items={tiles} columns={4} rowHeight={50} gap={4} aria-label="Tiles">
          {(t) => <span>{t.id}</span>}
        </Bento>
      ),
      400,
    );
    await frame();
    itemByKey(c, "a").focus();
    key(itemByKey(c, "a"), "ArrowRight");
    expect((document.activeElement as HTMLElement).dataset.key).toBe("b");
    key(document.activeElement!, "ArrowDown");
    // dense: a r0-1 c0-1, b r0 c2, d r0 c3, e r1-2 c3, g r1 c2, c r2 c0-2.
    expect((document.activeElement as HTMLElement).dataset.key).toBe("g");
    key(document.activeElement!, "ArrowLeft");
    expect((document.activeElement as HTMLElement).dataset.key).toBe("a");
  });

  it("aspect row height follows the column width", async () => {
    const c = mount(
      () => (
        <Bento items={[{ id: "x", rowSpan: 2 }, { id: "y" }]} columns={2} rowHeight={{ aspectRatio: 2 }} gap={0} aria-label="Tiles">
          {(t) => <span>{t.id}</span>}
        </Bento>
      ),
      400,
    );
    await frame();
    expect(Math.round(itemByKey(c, "x").getBoundingClientRect().height)).toBe(200);
    c.style.width = "800px";
    await frame();
    expect(Math.round(itemByKey(c, "x").getBoundingClientRect().height)).toBe(400);
  });
});

describe("Masonry virtualized", () => {
  it("sizes columns to the measured width (not the initial size) and follows resizes", async () => {
    const items = Array.from({ length: 200 }, (_, i) => ({ id: i, aspectRatio: 1 }));
    const c = mount(
      () => (
        <Masonry items={items} columns={5} gap={6} virtualize height={400} aria-label="Many">
          {(item) => <span>{String(item.id)}</span>}
        </Masonry>
      ),
      868,
    );
    const width = () => itemsOf(c)[0]!.getBoundingClientRect().width;
    const scroller = () => c.querySelector<HTMLElement>("[data-rv-scroller]")!;
    await until(() => Math.abs(width() - (scroller().clientWidth - 24) / 5) < 0.6);
    c.style.width = "600px";
    await until(() => Math.abs(width() - (scroller().clientWidth - 24) / 5) < 0.6);
  });

  const many = Array.from({ length: 10_000 }, (_, i) => ({ id: i, aspectRatio: [1, 0.75, 1.5][i % 3]! }));
  it("renders a window of 10k items and navigates past it", async () => {
    const c = mount(
      () => (
        <Masonry items={many} columns={4} gap={8} virtualize height={400} initialSize={{ width: 800, height: 400 }} aria-label="Many">
          {(item) => <span>{String(item.id)}</span>}
        </Masonry>
      ),
      800,
    );
    await frame();
    const count = itemsOf(c).length;
    expect(count).toBeGreaterThan(8);
    expect(count).toBeLessThan(120);
    const grid = gridOf(c);
    grid.focus();
    expect((document.activeElement as HTMLElement).dataset.key).toBe("0");
    for (let i = 0; i < 12; i++) {
      key(document.activeElement!, "ArrowDown");
      await frame();
    }
    const focused = document.activeElement as HTMLElement;
    expect(focused.hasAttribute("data-rv-item")).toBe(true);
    expect(Number(focused.dataset.key)).toBeGreaterThan(40);
    key(focused, "End");
    await until(() => (document.activeElement as HTMLElement).dataset.key === "9999");
    expect(itemsOf(c).length).toBeLessThan(160);
  });
});

/** Item boxes relative to the grid (start edge = left, LTR). */
const boxesOf = (c: HTMLElement) => {
  const g = gridOf(c).getBoundingClientRect();
  return itemsOf(c).map((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left - g.left, y: r.top - g.top, width: r.width, height: r.height };
  });
};
const near = (a: number, b: number, tol = 0.6) => Math.abs(a - b) < tol;

describe("Masonry justified", () => {
  it("server CSS = placeJustified at every width: rows fill the width, bottom flush (lastRow fill)", async () => {
    const items = photos.slice(0, 19);
    const c = mount(() => (
      <Masonry items={items} layout="justified" rowHeight={{ 0: 120, 700: 180 }} gap={6} aria-label="Rows">
        {(p) => <span>{p.id}</span>}
      </Masonry>
    ));
    const bps = resolveBreakpoints(1, null, 1, 6, [0, 700, ...justifiedSplits()]);
    const refs = referenceWidths(bps);
    const aspects = items.map((p) => p.aspectRatio);
    expect(bps.map((bp) => bp.min)).toEqual([0, 533, 700, 889, 1481, 2469]);
    for (const W of [360, 520, 699.5, 700, 900, 1300, 1600]) {
      c.style.width = W + "px";
      await frame();
      const width = gridOf(c).getBoundingClientRect().width;
      const b = breakpointAt(bps, width);
      const g = placeJustified(aspects, refs[b]!, { rowHeight: bps[b]!.min >= 700 ? 180 : 120, gap: [6, 6] });
      const want = rectsAt(g, width);
      const got = boxesOf(c);
      got.forEach((r, i) => {
        expect(near(r.x, want[i]!.x), `x ${i} @${W}`).toBe(true);
        expect(near(r.y, want[i]!.y), `y ${i} @${W}`).toBe(true);
        expect(near(r.width, want[i]!.width), `w ${i} @${W}`).toBe(true);
        expect(near(r.height, want[i]!.height), `h ${i} @${W}`).toBe(true);
      });
      // Every row ends at the container edge; the grid ends at the last row's bottom.
      const rows = new Map<number, number>();
      for (const r of got) rows.set(Math.round(r.y), Math.max(rows.get(Math.round(r.y)) ?? 0, r.x + r.width));
      for (const end of rows.values()) expect(Math.abs(end - width)).toBeLessThan(1);
      const bottom = Math.max(...got.map((r) => r.y + r.height));
      expect(Math.abs(gridOf(c).getBoundingClientRect().height - bottom)).toBeLessThan(1);
      expect(near(extentAt(g, width), bottom, 1)).toBe(true);
    }
  });
});

describe("Masonry per-breakpoint gaps, spans and fit", () => {
  it("gap maps + spans + fit=both: CSS = placeColumns / fitColumns at every width, flush bottom", async () => {
    const items = photos.map((p, i) => ({ ...p, span: i % 5 === 1 ? { 0: 1, 640: 2 } : 1 }));
    const c = mount(() => (
      <Masonry items={items} columns={{ 0: 2, 640: 3 }} gap={{ 0: 6, 640: [12, 20] }} fit="both" aria-label="Spans">
        {(p) => <span>{p.id}</span>}
      </Masonry>
    ));
    const bps = resolveBreakpoints({ 0: 2, 640: 3 }, null, 4, { 0: 6, 640: [12, 20] });
    const refs = referenceWidths(bps);
    for (const W of [400, 639, 640, 900, 1200]) {
      c.style.width = W + "px";
      await frame();
      const width = gridOf(c).getBoundingClientRect().width;
      const b = breakpointAt(bps, width);
      const bp = bps[b]!;
      const span = items.map((p) => (typeof p.span === "number" ? p.span : bp.min >= 640 ? 2 : 1));
      const run = placeColumns(
        { alpha: items.map((p) => 1 / p.aspectRatio), beta: items.map(() => 0), span },
        bp.columns,
        columnWidth(refs[b]!, bp.columns, bp.gap[0]),
        ...unitRange(bps, b),
        bp.gap[0],
        bp.gap[1],
      );
      const g = fitColumns(run, ...unitRange(bps, b));
      const u = columnWidth(width, bp.columns, bp.gap[0]);
      const want = rectsAt(g, u);
      const got = boxesOf(c);
      got.forEach((r, i) => {
        expect(near(r.x, want[i]!.x), `x ${i} @${W}`).toBe(true);
        expect(near(r.y, want[i]!.y), `y ${i} @${W}`).toBe(true);
        expect(near(r.width, want[i]!.width), `w ${i} @${W}`).toBe(true);
        expect(near(r.height, want[i]!.height), `h ${i} @${W}`).toBe(true);
      });
      const bottom = extentAt(g, u);
      for (let col = 0; col < bp.columns; col++) {
        const last = run.state.last[col]!;
        if (run.span[last] === 1 && !g.topMore?.[last]) expect(near(got[last]!.y + got[last]!.height, bottom, 1), `col ${col} @${W}`).toBe(true);
      }
    }
  });
});

describe("Masonry mixed lists", () => {
  it("server-places the known leading run, measures the rest below it", async () => {
    const items = [
      ...photos.slice(0, 5).map((p) => ({ id: p.id, aspectRatio: p.aspectRatio, lines: 0 })),
      ...Array.from({ length: 6 }, (_, i) => ({ id: `n${i}`, aspectRatio: undefined as number | undefined, lines: 1 + (i % 3) })),
    ];
    const c = mount(
      () => (
        <Masonry items={items} columns={3} gap={10} aria-label="Mixed">
          {(p) => (p.lines ? <div style={{ height: `${p.lines * 40}px` }}>{p.id}</div> : <span>{p.id}</span>)}
        </Masonry>
      ),
      600,
    );
    expect(c.querySelector("[data-rv-masonry]")!.getAttribute("data-layout")).toBe("mixed");
    const grid = gridOf(c);
    await until(() => grid.hasAttribute("data-measured"));
    await frame();
    const w = (grid.getBoundingClientRect().width - 20) / 3;
    const run = placeColumns(
      { alpha: items.slice(0, 5).map((p) => 1 / p.aspectRatio!), beta: [0, 0, 0, 0, 0] },
      3,
      columnWidth(referenceWidths(resolveBreakpoints(3))[0]!, 3, 10),
      0,
      1e5,
      10,
      10,
    );
    const prefix = rectsAt(run.geometry, w);
    const got = boxesOf(c);
    prefix.forEach((r, i) => {
      expect(near(got[i]!.x, r.x), `prefix x ${i}`).toBe(true);
      expect(near(got[i]!.y, r.y), `prefix y ${i}`).toBe(true);
    });
    // Measured items continue under the prefix columns, nothing overlaps.
    for (let i = 0; i < got.length; i++)
      for (let j = i + 1; j < got.length; j++) {
        const a = got[i]!;
        const b = got[j]!;
        const hit = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 0.5 && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 0.5;
        expect(hit, `${i} / ${j}`).toBe(false);
      }
    expect(Math.min(...got.slice(5).map((r) => r.y))).toBeGreaterThan(0);
  });
});

describe("Masonry item controls", () => {
  it("a live span grows one item: one placement, neighbours FLIP into place, final boxes = the layout", async () => {
    const expanded = signal<string | null>(null);
    let handle: MasonryHandle | null = null;
    const c = mount(
      () => (
        <Masonry
          items={photos.slice(0, 9)}
          columns={3}
          gap={10}
          aria-label="Grow"
          getSpan={(p) => () => (expanded() === p.id ? 2 : 1)}
          handleRef={(h) => (handle = h)}
        >
          {(p) => <span>{p.id}</span>}
        </Masonry>
      ),
      620,
    );
    await frame();
    const before = boxesOf(c);
    const writes: string[] = [];
    const observer = new MutationObserver((records) => {
      for (const r of records) if (r.attributeName === "style") writes.push((r.target as HTMLElement).dataset.key ?? "grid");
    });
    observer.observe(gridOf(c), { attributes: true, subtree: true, attributeFilter: ["style"] });
    expanded.set("p4");
    await Promise.resolve();
    await Promise.resolve();
    // Animation running: the grown item starts at its old size.
    const grown = itemByKey(c, "p4");
    expect(Math.abs(grown.getBoundingClientRect().width - before[4]!.width)).toBeLessThan(2);
    await until(() => itemsOf(c).every((el) => !el.style.transform), 3000);
    observer.disconnect();
    const w = (gridOf(c).getBoundingClientRect().width - 20) / 3;
    const span = photos.slice(0, 9).map((p) => (p.id === "p4" ? 2 : 1));
    const run = placeColumns(
      { alpha: photos.slice(0, 9).map((p) => 1 / p.aspectRatio), beta: new Array(9).fill(0), span },
      3,
      columnWidth(referenceWidths(resolveBreakpoints(3))[0]!, 3, 10),
      -10,
      1e5,
      10,
      10,
    );
    const want = rectsAt(run.geometry, w);
    boxesOf(c).forEach((r, i) => {
      expect(near(r.x, want[i]!.x), `x ${i}`).toBe(true);
      expect(near(r.y, want[i]!.y), `y ${i}`).toBe(true);
      expect(near(r.width, want[i]!.width), `w ${i}`).toBe(true);
    });
    // Items before p4 were not rewritten (incremental: same style objects).
    for (const k of ["p0", "p1", "p2", "p3"]) expect(writes.filter((x) => x === k).length, k).toBe(0);
    expect(itemsOf(c).length).toBe(9);
    expect(handle!.getPosition("p4")!.width).toBeCloseTo(want[4]!.width, 0);
  });

  it("motion={false} and reduced motion jump to the new layout", async () => {
    const original = window.matchMedia;
    window.matchMedia = ((q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {} })) as never;
    try {
      const expanded = signal(false);
      const c = mount(
        () => (
          <Masonry items={photos.slice(0, 6)} columns={3} gap={10} aria-label="Jump" getSpan={(p) => () => (p.id === "p0" && expanded() ? 3 : 1)}>
            {(p) => <span>{p.id}</span>}
          </Masonry>
        ),
        620,
      );
      await frame();
      expanded.set(true);
      await Promise.resolve();
      await Promise.resolve();
      expect(itemsOf(c).every((el) => !el.style.transform)).toBe(true);
      expect(Math.abs(itemByKey(c, "p0").getBoundingClientRect().width - gridOf(c).getBoundingClientRect().width)).toBeLessThan(0.6);
    } finally {
      window.matchMedia = original;
    }
  });

  it("measured spans: the grown card takes two columns (written width), neighbours re-place", async () => {
    const big = signal<number | null>(null);
    const notes = Array.from({ length: 8 }, (_, i) => ({ id: i, lines: 1 + (i % 3) }));
    const c = mount(
      () => (
        <Masonry items={notes} columns={3} gap={10} aria-label="Notes" layout="measure" getSpan={(n) => () => (big() === n.id ? 2 : 1)}>
          {(n) => <div style={{ height: `${n.lines * 30}px` }}>{String(n.id)}</div>}
        </Masonry>
      ),
      620,
    );
    const grid = gridOf(c);
    await until(() => grid.hasAttribute("data-measured"));
    big.set(2);
    await until(() => Math.abs(itemByKey(c, "2").getBoundingClientRect().width - ((grid.getBoundingClientRect().width - 20) / 3) * 2 - 10) < 0.6);
    await until(() => itemsOf(c).every((el) => !el.style.transform.includes(") translate")), 3000);
    await frame();
    await frame();
    const got = boxesOf(c);
    for (let i = 0; i < got.length; i++)
      for (let j = i + 1; j < got.length; j++) {
        const a = got[i]!;
        const b = got[j]!;
        const hit = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 0.5 && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 0.5;
        expect(hit, `${i} / ${j}`).toBe(false);
      }
  });
});

describe("Masonry fix round 1 (review 2026-10-11)", () => {
  it("load more keeps the rendered rows: one render per new item, same img nodes, focus kept", async () => {
    const list = signal(photos.slice(0, 8));
    const renders: string[] = [];
    const c = mount(() => (
      <Masonry items={list} columns={3} gap={10} aria-label="More" motion={false}>
        {(p) => {
          renders.push(p.id);
          return <img alt={p.id} data-id={p.id} />;
        }}
      </Masonry>
    ));
    await frame();
    const imgs = [...c.querySelectorAll("img")];
    const focused = itemByKey(c, "p3");
    focused.focus();
    renders.length = 0;
    // A new array with the same item objects + 4 more (load more).
    list.set([...photos.slice(0, 8), ...photos.slice(8, 12)]);
    await frame();
    expect(renders).toEqual(["p8", "p9", "p10", "p11"]);
    expect([...c.querySelectorAll("img")].slice(0, 8)).toEqual(imgs);
    expect(document.activeElement).toBe(focused);
    // A replaced item object with the same key re-renders only that row.
    renders.length = 0;
    list.set(list().map((p) => (p.id === "p2" ? { ...p } : p)));
    await frame();
    expect(renders).toEqual(["p2"]);
  });

  it("layout props are live: columns, gap and maxWidth relayout in place (rows kept)", async () => {
    const columns = signal(2);
    const gap = signal(10);
    const maxWidth = signal<number | undefined>(undefined);
    const c = mount(
      () => (
        <Masonry items={photos.slice(0, 9)} columns={columns()} gap={gap()} maxWidth={maxWidth()} aria-label="Live" motion={false}>
          {(p) => <span>{p.id}</span>}
        </Masonry>
      ),
      620,
    );
    await frame();
    const kept = itemByKey(c, "p5");
    const check = (n: number, g: number) => {
      const W = gridOf(c).getBoundingClientRect().width;
      const bps = resolveBreakpoints(n, undefined, 4, g);
      const run = placeColumns(
        { alpha: photos.slice(0, 9).map((p) => 1 / p.aspectRatio), beta: new Array(9).fill(0) },
        n,
        columnWidth(referenceWidths(bps)[0]!, n, g),
        -g,
        1e5,
        g,
        g,
      );
      const want = rectsAt(run.geometry, (W - (n - 1) * g) / n);
      boxesOf(c).forEach((r, i) => {
        expect(near(r.x, want[i]!.x), `x ${i}`).toBe(true);
        expect(near(r.y, want[i]!.y), `y ${i}`).toBe(true);
      });
    };
    check(2, 10);
    columns.set(3);
    await frame();
    check(3, 10);
    gap.set(4);
    await frame();
    check(3, 4);
    maxWidth.set(400);
    await frame();
    expect(c.querySelector<HTMLElement>("[data-rv-masonry]")!.getBoundingClientRect().width).toBe(400);
    check(3, 4);
    expect(itemByKey(c, "p5")).toBe(kept);
  });

  it("justified items without a ratio are measured in the browser (hidden until placed), never a silent square", async () => {
    const items = [
      { id: "a", aspectRatio: 1.5 },
      { id: "b", w: 300, h: 100 },
      { id: "c", aspectRatio: 0.75 },
    ];
    const c = mount(
      () => (
        <Masonry
          items={items}
          layout="justified"
          rowHeight={100}
          gap={0}
          aria-label="Unknown"
          getAspectRatio={(p) => (p as { aspectRatio?: number }).aspectRatio}
        >
          {(p) => {
            const q = p as { w?: number; h?: number };
            return q.w ? <div style={{ width: "100%", "aspect-ratio": `${q.w} / ${q.h}` }} /> : <span>{p.id}</span>;
          }}
        </Masonry>
      ),
      525,
    );
    await until(() => itemByKey(c, "b").style.visibility !== "hidden");
    await frame();
    const boxes = boxesOf(c);
    // Ratios 1.5 + 3 + 0.75 = 5.25 → one row of height 525 / 5.25 = 100.
    expect(near(boxes[1]!.width, 300)).toBe(true);
    expect(near(boxes[1]!.height, 100)).toBe(true);
    expect(near(boxes[2]!.x, 450)).toBe(true);
  });

  it("unmount mid-animation stops the FLIP (detached grid, no further writes)", async () => {
    const expanded = signal<string | null>(null);
    const c = mount(
      () => (
        <Masonry items={photos.slice(0, 6)} columns={3} gap={10} aria-label="Gone" getSpan={(p) => () => (expanded() === p.id ? 2 : 1)}>
          {(p) => <span>{p.id}</span>}
        </Masonry>
      ),
      620,
    );
    await frame();
    const grid = gridOf(c);
    expanded.set("p0");
    await frame();
    const moving = itemsOf(c).filter((el) => el.style.transform);
    expect(moving.length).toBeGreaterThan(0);
    cleanup();
    expect(grid.isConnected).toBe(false);
    const snapshot = moving.map((el) => el.style.cssText);
    await frame();
    await frame();
    expect(moving.map((el) => el.style.cssText)).toEqual(snapshot);
  });

  it("FLIP from the previous geometry with motion on: a second toggle mid-animation starts from the current boxes", async () => {
    const expanded = signal<string | null>(null);
    const c = mount(
      () => (
        <Masonry items={photos.slice(0, 9)} columns={3} gap={10} aria-label="Flip" getSpan={(p) => () => (expanded() === p.id ? 2 : 1)}>
          {(p) => <span>{p.id}</span>}
        </Masonry>
      ),
      620,
    );
    await frame();
    expanded.set("p1");
    await frame();
    const mid = itemByKey(c, "p4").getBoundingClientRect();
    expanded.set(null);
    await Promise.resolve();
    await Promise.resolve();
    const after = itemByKey(c, "p4").getBoundingClientRect();
    // No jump: the reversed animation starts where the item was.
    expect(Math.abs(after.left - mid.left)).toBeLessThan(6);
    expect(Math.abs(after.top - mid.top)).toBeLessThan(6);
    await until(() => itemsOf(c).every((el) => !el.style.transform), 3000);
  });
});

describe("Masonry fix round 2 (review 2026-10-12)", () => {
  it("pending justified items wait in a provisional row below the prefix: side by side, grid height includes it, no page overflow", async () => {
    // a, b known; the rest have no ratio and a 0×0 box (an <img> without src), so they stay pending.
    const items = [{ id: "a", aspectRatio: 1.5 }, { id: "b", aspectRatio: 1 }, ...Array.from({ length: 40 }, (_, i) => ({ id: `u${i}` }))];
    const c = mount(
      () => (
        <Masonry
          items={items}
          layout="justified"
          rowHeight={100}
          gap={10}
          aria-label="Pending"
          getAspectRatio={(p) => (p as { aspectRatio?: number }).aspectRatio}
        >
          {(p) => ((p as { aspectRatio?: number }).aspectRatio ? <span>{p.id}</span> : <img alt="" loading="lazy" />)}
        </Masonry>
      ),
      400,
    );
    await frame();
    const g = gridOf(c).getBoundingClientRect();
    const boxes = boxesOf(c);
    const prefixBottom = Math.max(boxes[0]!.y + boxes[0]!.height, boxes[1]!.y + boxes[1]!.height);
    // Provisional row: top = prefix bottom + row gap, 1:1 placeholders at the row height, advancing by height + gap.
    for (let j = 0; j < 4; j++) {
      const r = boxes[2 + j]!;
      expect(near(r.y, prefixBottom + 10), `top ${j}`).toBe(true);
      expect(near(r.x, j * 110), `x ${j}`).toBe(true);
      expect(near(r.width, 100), `width ${j}`).toBe(true);
    }
    expect(itemByKey(c, "u0").style.visibility).toBe("hidden");
    // Slots past PENDING_SLOTS (24) wait past the inline end; the grid clips them (no horizontal page scroll).
    expect(boxes[2 + 30]!.x).toBeGreaterThanOrEqual(g.width - 0.5);
    expect(near(g.height, prefixBottom + 10 + 100)).toBe(true);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
    // Clipped placeholders never intersect the viewport (lazy images there stay unloaded).
    const seen = await new Promise<boolean>((resolve) => {
      const io = new IntersectionObserver((entries) => (io.disconnect(), resolve(entries[0]!.isIntersecting)));
      io.observe(itemByKey(c, "u30"));
    });
    expect(seen).toBe(false);
  });

  it("reorder moves the same row nodes (index accessors update, no re-render)", async () => {
    const list = signal(photos.slice(0, 6));
    const renders: string[] = [];
    const c = mount(() => (
      <Masonry items={list} columns={3} gap={10} aria-label="Reorder" motion={false}>
        {(p, state) => {
          renders.push(p.id);
          return <span data-index={() => String(state.index())}>{p.id}</span>;
        }}
      </Masonry>
    ));
    await frame();
    const nodes = new Map(itemsOf(c).map((el) => [el.dataset.key!, el]));
    renders.length = 0;
    const reversed = [...list()].reverse();
    list.set(reversed);
    await frame();
    expect(renders).toEqual([]);
    expect(itemsOf(c).map((el) => el.dataset.key)).toEqual(reversed.map((p) => p.id));
    for (const p of reversed) expect(itemByKey(c, p.id)).toBe(nodes.get(p.id));
    expect(itemsOf(c).map((el) => el.querySelector("span")!.dataset.index)).toEqual(["0", "1", "2", "3", "4", "5"]);
    // Placement follows the new reading order.
    const run = placeColumns(
      { alpha: reversed.map((p) => 1 / p.aspectRatio), beta: new Array(6).fill(0) },
      3,
      columnWidth(referenceWidths(resolveBreakpoints(3, undefined, 4, 10))[0]!, 3, 10),
      -10,
      1e5,
      10,
      10,
    );
    const W = gridOf(c).getBoundingClientRect().width;
    const want = rectsAt(run.geometry, (W - 20) / 3);
    boxesOf(c).forEach((r, i) => expect(near(r.y, want[i]!.y), `y ${i}`).toBe(true));
  });

  it("middle removal keeps the other rows and re-places them", async () => {
    const list = signal(photos.slice(0, 7));
    const renders: string[] = [];
    const c = mount(() => (
      <Masonry items={list} columns={3} gap={10} aria-label="Remove" motion={false}>
        {(p) => {
          renders.push(p.id);
          return <span>{p.id}</span>;
        }}
      </Masonry>
    ));
    await frame();
    const nodes = new Map(itemsOf(c).map((el) => [el.dataset.key!, el]));
    renders.length = 0;
    const rest = list().filter((p) => p.id !== "p3");
    list.set(rest);
    await frame();
    expect(renders).toEqual([]);
    expect(itemsOf(c).map((el) => el.dataset.key)).toEqual(rest.map((p) => p.id));
    for (const p of rest) expect(itemByKey(c, p.id)).toBe(nodes.get(p.id));
    expect(nodes.get("p3")!.isConnected).toBe(false);
    const W = gridOf(c).getBoundingClientRect().width;
    const run = placeColumns(
      { alpha: rest.map((p) => 1 / p.aspectRatio), beta: new Array(6).fill(0) },
      3,
      columnWidth(referenceWidths(resolveBreakpoints(3, undefined, 4, 10))[0]!, 3, 10),
      -10,
      1e5,
      10,
      10,
    );
    const want = rectsAt(run.geometry, (W - 20) / 3);
    boxesOf(c).forEach((r, i) => {
      expect(near(r.x, want[i]!.x), `x ${i}`).toBe(true);
      expect(near(r.y, want[i]!.y), `y ${i}`).toBe(true);
    });
  });
});
