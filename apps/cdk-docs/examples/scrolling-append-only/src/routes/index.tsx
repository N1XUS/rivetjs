import { createVirtualScroll, CdkVirtualScrollViewport } from "@rivetjs/cdk/scrolling";
import "@rivetjs/cdk/scrolling.css";

export const head = { title: "Virtual scroll: appendOnly" };

const items = Array.from({ length: 1000 }, (_, i) => `Item #${i}`);

// #region demo
export default function AppendOnly() {
  const state = createVirtualScroll({ id: "append", items, itemSize: 40, appendOnly: true, initialViewportSize: 240 });
  return (
    <section class="stack">
      <CdkVirtualScrollViewport state={state} class="viewport" label="Items">
        {(item, ctx) => (
          <div class="row" data-index={ctx.index()}>
            {item()}
          </div>
        )}
      </CdkVirtualScrollViewport>
      <output id="append-count">
        {state.range().end - state.range().start} rows rendered from {state.range().start}
      </output>
    </section>
  );
}
// #endregion
