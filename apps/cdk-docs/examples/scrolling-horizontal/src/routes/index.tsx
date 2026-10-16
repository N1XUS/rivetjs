import { createVirtualScroll, CdkVirtualScrollViewport, scrollToOffset } from "@rivetjs/cdk/scrolling";
import "@rivetjs/cdk/scrolling.css";

export const head = { title: "Virtual scroll: horizontal" };

const numbers = Array.from({ length: 1000 }, (_, i) => i);

// #region demo
export default function Strips() {
  const ltr = createVirtualScroll({ id: "ltr-strip", items: numbers, itemSize: 50, orientation: "horizontal", initialViewportSize: 320 });
  const rtl = createVirtualScroll({ id: "rtl-strip", items: numbers, itemSize: 50, orientation: "horizontal", initialViewportSize: 320 });
  return (
    <section class="stack">
      <CdkVirtualScrollViewport state={ltr} class="strip" label="Numbers">
        {(n) => <div class="col">{n()}</div>}
      </CdkVirtualScrollViewport>
      <button id="ltr-go" type="button" onClick={() => scrollToOffset(ltr, 1000)}>
        scrollToOffset(1000)
      </button>
      <div dir="rtl" class="stack">
        <CdkVirtualScrollViewport state={rtl} class="strip" label="מספרים">
          {(n) => <div class="col">{n()}</div>}
        </CdkVirtualScrollViewport>
        <button id="rtl-go" type="button" onClick={() => scrollToOffset(rtl, 1000)}>
          scrollToOffset(1000)
        </button>
      </div>
    </section>
  );
}
// #endregion
