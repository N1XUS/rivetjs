// Lane `rivet`: @rivetjs/cdk/masonry in its three modes. `exact` = known ratios placed by inline CSS (a resize is pure
// CSS: no script), `measure` = unknown sizes (CSS columns first paint, `reflowMeasured` places by measured heights;
// resize runs the same reflow the ResizeObserver would schedule), `virtual` = Virtualizer + MasonryLayout;
// `exact-fixed` = exact with one fixed column count (plain calc, no breakpoint max() terms), `justified` = justified rows
// (server CSS, rowHeight 200; `justified-max`: `maxWidth={1400}`, bounded last range). `toggle(i)` = live `getSpan` of
// item i (1 ↔ 2): one incremental relayout, `motion={false}`.
import { render } from "@rivetjs/runtime/dom";
import { signal } from "@rivetjs/reactivity";
import { Masonry } from "@rivetjs/cdk/masonry";
import { reflowMeasured } from "@rivetjs/cdk/masonry/behaviour";
import { GAP, tiles, type MasonryBench, type Mode } from "./shape.ts";

let dispose: (() => void) | null = null;
let current: Mode = "exact";
const breakpoints = [
  { min: 0, columns: 2, gap: [GAP, GAP] as [number, number] },
  { min: 640, columns: 3, gap: [GAP, GAP] as [number, number] },
  { min: 1024, columns: 4, gap: [GAP, GAP] as [number, number] },
];
const wide = signal<number | null>(null);
const host = () => document.querySelector<HTMLElement>("#host")!;
const grid = () => host().querySelector<HTMLElement>("[data-rv-grid]")!;
const bench: MasonryBench = {
  mount(count, mode) {
    current = mode;
    const items = tiles(count);
    const exact = mode !== "measure";
    wide.set(null);
    dispose = render(
      () => (
        <Masonry
          items={items}
          columns={mode === "exact-fixed" ? 3 : { 0: 2, 640: 3, 1024: 4 }}
          gap={GAP}
          aria-label="Tiles"
          getAspectRatio={exact ? (t) => t.aspectRatio : () => null}
          layout={mode === "justified" || mode === "justified-max" ? "justified" : "auto"}
          rowHeight={200}
          maxWidth={mode === "justified-max" ? 1400 : undefined}
          getSpan={exact && mode !== "virtual" ? (t) => () => (t.id === wide() ? 2 : 1) : undefined}
          motion={false}
          virtualize={mode === "virtual"}
          height={mode === "virtual" ? 700 : undefined}
        >
          {(t) => (
            <div class="tile" style={{ "aspect-ratio": String(t.aspectRatio), height: exact ? "100%" : undefined }}>
              {t.label}
            </div>
          )}
        </Masonry>
      ),
      host(),
    );
    if (mode === "measure") reflowMeasured(grid(), { breakpoints });
    return bench.rendered();
  },
  resize(width) {
    host().style.width = `${width}px`;
    if (current === "measure") reflowMeasured(grid(), { breakpoints });
  },
  toggle(index = 0) {
    if (current === "measure" || current === "virtual") return false;
    wide.set(wide() === index ? null : index);
    return true;
  },
  height() {
    const top = host().getBoundingClientRect().top;
    let max = 0;
    for (const el of host().querySelectorAll("[data-rv-item]")) max = Math.max(max, el.getBoundingClientRect().bottom - top);
    return max;
  },
  scroller: () => host().querySelector<HTMLElement>("[data-rv-scroller]"),
  rendered: () => host().querySelectorAll("[data-rv-item]").length,
  dispose() {
    dispose?.();
    dispose = null;
    host().textContent = "";
  },
};
(window as unknown as { masonryBench: MasonryBench }).masonryBench = bench;
