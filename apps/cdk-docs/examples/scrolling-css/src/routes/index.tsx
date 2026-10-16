import { createVirtualScroll, CdkVirtualScrollViewport } from "@rivetjs/cdk/scrolling";

export const head = { title: "Virtual scroll: plain CSS" };

const cards = Array.from({ length: 500 }, (_, i) => `Card ${i}`);

// #region demo
export default function Cards() {
  // 44px row + 4px margin: the fixed item size is 48.
  const state = createVirtualScroll({ id: "css-vp", items: cards, itemSize: 48, initialViewportSize: 240 });
  return (
    <CdkVirtualScrollViewport state={state} label="Cards">
      {(card) => <div class="item">{card()}</div>}
    </CdkVirtualScrollViewport>
  );
}
// #endregion
