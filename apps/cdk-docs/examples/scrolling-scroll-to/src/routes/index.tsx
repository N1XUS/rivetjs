import { signal } from "@rivetjs/reactivity";
import { createVirtualScroll, CdkVirtualScrollViewport, scrollToIndex, scrollToOffset } from "@rivetjs/cdk/scrolling";
import "@rivetjs/cdk/scrolling.css";

export const head = { title: "Virtual scroll: scrollToIndex" };

const items = Array.from({ length: 1000 }, (_, i) => `Item #${i}`);

// #region demo
export default function Jump() {
  const first = signal(0);
  const state = createVirtualScroll({ id: "jump", items, itemSize: 40, initialViewportSize: 240 });
  return (
    <section class="stack">
      <p class="buttons">
        <button id="to-500" type="button" onClick={() => scrollToIndex(state, 500)}>
          scrollToIndex(500)
        </button>
        <button id="to-offset" type="button" onClick={() => scrollToOffset(state, 1000)}>
          scrollToOffset(1000)
        </button>
        <button id="to-last" type="button" onClick={() => scrollToIndex(state, items.length - 1)}>
          Last item
        </button>
        <button id="to-first-smooth" type="button" onClick={() => scrollToIndex(state, 0, "smooth")}>
          First item (smooth)
        </button>
      </p>
      <CdkVirtualScrollViewport state={state} class="viewport" label="Items" onScrolledIndexChange={(index) => first.set(index)}>
        {(item, ctx) => (
          <div class="row" data-index={ctx.index()} data-odd={String(ctx.odd())}>
            {item()}
          </div>
        )}
      </CdkVirtualScrollViewport>
      <output id="jump-index">First visible: {first()}</output>
    </section>
  );
}
// #endregion
