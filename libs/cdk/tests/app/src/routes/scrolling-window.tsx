import { createVirtualScroll, CdkVirtualScrollViewport, CdkVirtualScrollableElement } from "@rivetjs/cdk/scrolling";
import "@rivetjs/cdk/scrolling.css";

export const head = { title: "Virtual scroll (window / element)" };

const numbers = Array.from({ length: 2000 }, (_, i) => i);

export default function ScrollingWindowStory() {
  const inner = createVirtualScroll({ id: "inner", items: numbers, itemSize: 50, scrollable: "element", initialViewportSize: 200 });
  const win = createVirtualScroll({ id: "win", items: numbers, itemSize: 50, scrollable: "window", initialViewportSize: 600 });
  return (
    <section>
      <h1>Window and element scrolling</h1>
      <CdkVirtualScrollableElement id="scroller" class="scroller" states={[inner]}>
        <p class="above">Above the list</p>
        <CdkVirtualScrollViewport state={inner}>{(n) => <div class="row">Inner {n()}</div>}</CdkVirtualScrollViewport>
      </CdkVirtualScrollableElement>
      <CdkVirtualScrollViewport state={win}>{(n) => <div class="row">Window {n()}</div>}</CdkVirtualScrollViewport>
    </section>
  );
}
