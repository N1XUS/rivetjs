import { signal } from "@rivetjs/reactivity";
import { createVirtualScroll, CdkVirtualScrollViewport } from "@rivetjs/cdk/scrolling";
import "@rivetjs/cdk/scrolling.css";

export const head = { title: "Virtual scroll: fixed size" };

const items = Array.from({ length: 10000 }, (_, i) => `Item #${i}`);

// #region demo
export default function FixedSize() {
  const first = signal(0);
  // initialViewportSize: the viewport height the server renders for (match the CSS).
  const state = createVirtualScroll({ id: "fixed", items, itemSize: 40, initialViewportSize: 240 });
  return (
    <section class="stack">
      <CdkVirtualScrollViewport state={state} class="viewport" label="Items" onScrolledIndexChange={(index) => first.set(index)}>
        {(item, ctx) => (
          <div class="row" data-index={ctx.index()} data-odd={String(ctx.odd())}>
            {item()}
          </div>
        )}
      </CdkVirtualScrollViewport>
      <output id="fixed-index">First visible: {first()}</output>
    </section>
  );
}
// #endregion
