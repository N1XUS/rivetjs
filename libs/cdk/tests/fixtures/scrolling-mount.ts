// Test fixture (browser bundle): mounts a virtual scroll viewport in plain DOM with a tiny keyed row
// renderer (stand-in for CdkVirtualForOf), mirroring the Angular spec components
// (FixedSizeVirtualScroll & co.: 200px viewport, 100px cross size, 50px items, buffers 0).
import { effect, signal, untrack } from "@rivetjs/reactivity";
import { createVirtualScroll, type VirtualScrollState } from "../../scrolling/state.ts";
import { virtualScrollViewport, type VirtualScrollViewport } from "../../scrolling/virtual-scroll-viewport.ts";
export * from "../../scrolling/index.tsx";
export { signal, untrack };

export interface MountOptions {
  items?: unknown[];
  itemSize?: number;
  minBufferPx?: number;
  maxBufferPx?: number;
  orientation?: "vertical" | "horizontal";
  dir?: "ltr" | "rtl";
  hasMargin?: boolean;
  appendOnly?: boolean;
  autosize?: boolean;
  /** Autosize: per-item sizes (px). */
  sizes?: number[];
  viewportSize?: number;
  viewportCrossSize?: number;
  scrollable?: "self" | "element" | "window";
  trackByIndex?: boolean;
}

const css = `
.cdk-virtual-scroll-viewport { display: block; position: relative; transform: translateZ(0); background: #f5f5f5; }
.cdk-virtual-scrollable { overflow: auto; will-change: scroll-position; contain: strict; overflow-anchor: none; scroll-behavior: auto; }
.cdk-virtual-scroll-content-wrapper { position: absolute; top: 0; left: 0; contain: content; display: flex; flex-direction: column; }
[dir='rtl'] .cdk-virtual-scroll-content-wrapper { right: 0; left: auto; }
.cdk-virtual-scroll-orientation-horizontal .cdk-virtual-scroll-content-wrapper { min-height: 100%; flex-direction: row; }
.cdk-virtual-scroll-orientation-vertical .cdk-virtual-scroll-content-wrapper { min-width: 100%; }
.cdk-virtual-scroll-spacer { height: 1px; transform-origin: 0 0; flex: 0 0 auto; }
[dir='rtl'] .cdk-virtual-scroll-spacer { transform-origin: 100% 0; }
.item { box-sizing: border-box; border: 1px dashed #ccc; flex: none; }
.has-margin .item { margin-bottom: 10px; }
.scrolling-element { padding-top: 50px; height: 200px; width: 200px; overflow-y: auto; }
`;

let id = 0;

export function mount(o: MountOptions = {}) {
  if (!document.getElementById("vs-css")) document.head.insertAdjacentHTML("beforeend", `<style id="vs-css">${css}</style>`);
  const itemSize = o.itemSize ?? 50;
  const orientation = o.orientation ?? "vertical";
  const horizontal = orientation === "horizontal";
  const items = signal<readonly unknown[]>(o.items ?? Array.from({ length: 10 }, (_, i) => i));
  const state: VirtualScrollState<unknown> = createVirtualScroll({
    id: "vs" + ++id,
    items,
    itemSize,
    autosize: o.autosize,
    minBufferPx: o.minBufferPx ?? 0,
    maxBufferPx: o.maxBufferPx ?? 0,
    orientation,
    appendOnly: o.appendOnly,
    scrollable: o.scrollable,
    initialViewportSize: o.viewportSize ?? 200,
  });
  const size = o.viewportSize ?? 200,
    cross = o.viewportCrossSize ?? 100;
  const host = document.createElement("div");
  host.className = "host";
  const el = document.createElement("div");
  el.id = state.id;
  el.className =
    "cdk-virtual-scroll-viewport" +
    (state.scrollable === "self" ? " cdk-virtual-scrollable" : "") +
    (horizontal ? " cdk-virtual-scroll-orientation-horizontal" : " cdk-virtual-scroll-orientation-vertical") +
    (o.hasMargin ? " has-margin" : "");
  if (o.dir) el.dir = o.dir;
  if (state.scrollable !== "window") {
    el.style.width = (horizontal ? size : cross) + "px";
    el.style.height = (horizontal ? cross : size) + "px";
  }
  const wrapper = document.createElement("div");
  wrapper.className = "cdk-virtual-scroll-content-wrapper";
  const start = document.createElement("template");
  start.setAttribute("data-rv-vfor", state.id);
  const end = document.createElement("template");
  end.setAttribute("data-rv-vfor-end", "");
  wrapper.append(start, end);
  const spacer = document.createElement("div");
  spacer.className = "cdk-virtual-scroll-spacer";
  el.append(wrapper, spacer);
  if (state.scrollable === "element") {
    const scroller = document.createElement("div");
    scroller.className = "scrolling-element cdk-virtual-scrollable";
    scroller.setAttribute("data-rv-virtual-scrollable", "");
    scroller.append(el);
    host.append(scroller);
  } else host.append(el);
  document.body.append(host);

  // Keyed rows (by item, or index): counts created rows (Angular `_getEmbeddedViewArgs` spy).
  let created = 0;
  const rows = new Map<unknown, HTMLElement>();
  const dispose = [
    effect(() => {
      const { start: s, end: e } = state.range();
      const data = state.items().slice(s, e);
      untrack(() => {
        const next = new Map<unknown, HTMLElement>();
        data.forEach((item, i) => {
          const key = o.trackByIndex ? s + i : item;
          let row = rows.get(key);
          if (!row) {
            created++;
            row = document.createElement("div");
            row.className = "item";
          }
          const px = o.autosize && o.sizes ? o.sizes[s + i]! : itemSize;
          row.style.height = (horizontal ? itemSize : px) + "px";
          row.style.width = (horizontal ? px : itemSize) + "px";
          row.textContent = `${s + i} - ${String(item)}`;
          next.set(key, row);
          end.before(row);
        });
        for (const [key, row] of rows) if (!next.has(key)) row.remove();
        rows.clear();
        for (const [k, v] of next) rows.set(k, v);
      });
    }),
    effect(() => (wrapper.style.transform = state.transform())),
    effect(() => {
      const total = state.totalSize() + "px";
      spacer.style.width = horizontal ? total : "";
      spacer.style.height = horizontal ? "" : total;
    }),
  ];
  let scrolledToIndex = 0;
  return {
    state,
    el,
    wrapper,
    items,
    get scrolledToIndex() {
      return scrolledToIndex;
    },
    created: () => created,
    viewport: (): VirtualScrollViewport => (el as unknown as { __rivetVirtualScroll: VirtualScrollViewport }).__rivetVirtualScroll,
    /** Angular `finishInit`: attach the engine, flush the initial fake scroll. */
    async init() {
      virtualScrollViewport(state, el, { onScrolledIndexChange: (i: number) => (scrolledToIndex = i) });
      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => setTimeout(r, 0));
    },
    /** Rivet: attach the engine without callbacks (an API call such as `scrollToIndex` before any viewport event). */
    async initBare() {
      virtualScrollViewport(state, el);
      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => setTimeout(r, 0));
    },
    /** Rivet: the callbacks the first viewport event hands over (`viewportInteract`). */
    attachCallbacks() {
      virtualScrollViewport(state, undefined, { onScrolledIndexChange: (i: number) => (scrolledToIndex = i) });
    },
    /** Angular `triggerScroll`. */
    async scroll(offset?: number) {
      const vp = this.viewport();
      if (offset !== undefined) vp.scrollToOffset(offset);
      vp.scrollable.getElementRef().nativeElement.dispatchEvent(new Event("scroll"));
      if (state.scrollable === "window") document.dispatchEvent(new Event("scroll"));
      await new Promise((r) => setTimeout(r, 50));
    },
    destroy() {
      this.viewport()?.destroy();
      dispose.forEach((d) => d());
      host.remove();
    },
  };
}
