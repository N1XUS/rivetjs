import { createVirtualScroll, CdkVirtualScrollViewport, CdkVirtualScrollableElement } from "@rivetjs/cdk/scrolling";
import "@rivetjs/cdk/scrolling.css";

export const head = { title: "Virtual scroll: scrolling ancestor" };

const items = Array.from({ length: 2000 }, (_, i) => `Entry ${i}`);

// #region demo
export default function Feed() {
  const inner = createVirtualScroll({ id: "inner", items, itemSize: 40, scrollable: "element", initialViewportSize: 260 });
  return (
    <section>
      <button id="feed-jump" type="button" onClick={() => (document.getElementById("feed-scroller")!.scrollTop = 1650)}>
        Scroll the container to 1650px
      </button>
      {/* Pass the states of the viewports it scrolls: its scroll event starts their engines. */}
      <CdkVirtualScrollableElement id="feed-scroller" class="scroller" states={[inner]}>
        <p class="intro">A header that scrolls away with the list.</p>
        <CdkVirtualScrollViewport state={inner} label="Entries">
          {(entry, ctx) => (
            <div class="row" data-index={ctx.index()}>
              {entry()}
            </div>
          )}
        </CdkVirtualScrollViewport>
      </CdkVirtualScrollableElement>
    </section>
  );
}
// #endregion
