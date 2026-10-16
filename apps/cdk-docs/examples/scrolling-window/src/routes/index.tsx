import { createVirtualScroll, CdkVirtualScrollViewport } from "@rivetjs/cdk/scrolling";
import "@rivetjs/cdk/scrolling.css";

export const head = { title: "Virtual scroll: window scrolling" };

const items = Array.from({ length: 5000 }, (_, i) => `Row ${i}`);

// #region demo
export default function PageList() {
  // initialViewportSize: the window height assumed for the server-rendered range.
  const state = createVirtualScroll({ id: "page-list", items, itemSize: 40, scrollable: "window", initialViewportSize: 600 });
  return (
    <main>
      <div class="bar">
        <button id="page-jump" type="button" onClick={() => window.scrollTo(0, 4000)}>
          Scroll the page to 4000px
        </button>
      </div>
      <CdkVirtualScrollViewport state={state} label="Rows">
        {(row, ctx) => (
          <div class="row" data-index={ctx.index()}>
            {row()}
          </div>
        )}
      </CdkVirtualScrollViewport>
    </main>
  );
}
// #endregion
