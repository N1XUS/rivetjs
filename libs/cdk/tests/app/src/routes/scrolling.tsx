import { signal } from "@rivetjs/reactivity";
import { createVirtualScroll, CdkVirtualScrollViewport, CdkVirtualForOf, scrollToIndex, scrollToOffset } from "@rivetjs/cdk/scrolling";
import "@rivetjs/cdk/scrolling.css";

export const head = { title: "Virtual scroll" };

const numbers = Array.from({ length: 10000 }, (_, i) => i);
const people = Array.from({ length: 500 }, (_, i) => ({ id: i, name: `Person ${i}`, lines: 1 + (i % 4) }));

export default function ScrollingStory() {
  const index = signal(0);
  const items = signal(numbers);
  const fixed = createVirtualScroll({ id: "fixed", items, itemSize: 50, initialViewportSize: 200 });
  const horizontal = createVirtualScroll({ id: "horizontal", items: numbers.slice(0, 1000), itemSize: 50, orientation: "horizontal", initialViewportSize: 200 });
  const rtl = createVirtualScroll({ id: "rtl", items: numbers.slice(0, 1000), itemSize: 50, orientation: "horizontal", initialViewportSize: 200 });
  const auto = createVirtualScroll({ id: "auto", items: people, autosize: true, initialViewportSize: 200 });
  const append = createVirtualScroll({ id: "append", items: numbers.slice(0, 1000), itemSize: 50, appendOnly: true, initialViewportSize: 200 });
  return (
    <section>
      <h1>Virtual scroll</h1>
      <p>
        First visible: <output id="fixed-index">{index()}</output> <output id="fixed-range">{fixed.range().start}</output>{" "}
        <button id="to-500" type="button" onClick={() => scrollToIndex(fixed, 500)}>
          Index 500
        </button>{" "}
        <button id="to-offset" type="button" onClick={() => scrollToOffset(fixed, 1000)}>
          Offset 1000
        </button>{" "}
        <button id="shrink" type="button" onClick={() => items.set(numbers.slice(0, 20))}>
          Shrink to 20
        </button>
      </p>
      <CdkVirtualScrollViewport state={fixed} class="vp" onScrolledIndexChange={(i) => index.set(i)}>
        {(n, ctx) => (
          <div class="row" data-index={ctx.index()} data-odd={String(ctx.odd())}>
            Item {n()}
          </div>
        )}
      </CdkVirtualScrollViewport>
      <CdkVirtualScrollViewport state={horizontal} class="vp-h">{(n) => <div class="col">{n()}</div>}</CdkVirtualScrollViewport>
      <div dir="rtl">
        <CdkVirtualScrollViewport state={rtl} class="vp-h">{(n) => <div class="col">{n()}</div>}</CdkVirtualScrollViewport>
      </div>
      <CdkVirtualScrollViewport state={auto} class="vp">
        <ul role="list">
          <CdkVirtualForOf state={auto} trackBy={(_, p) => p.id}>{(p) => <li class="person" style={{ height: `${p().lines * 25}px` }}>{p().name}</li>}</CdkVirtualForOf>
        </ul>
      </CdkVirtualScrollViewport>
      <CdkVirtualScrollViewport state={append} class="vp">{(n) => <div class="row">Item {n()}</div>}</CdkVirtualScrollViewport>
    </section>
  );
}
