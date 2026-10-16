import { signal } from "@rivetjs/reactivity";
import { createVirtualScroll, CdkVirtualScrollViewport, type ListRange } from "@rivetjs/cdk/scrolling";
import "@rivetjs/cdk/scrolling.css";

export const head = { title: "Virtual scroll: rendered range" };

const make = (n: number) => Array.from({ length: n }, (_, i) => `Item #${i}`);

// #region demo
export default function Range() {
  const items = signal(make(1000));
  const log = signal<string[]>([]);
  const state = createVirtualScroll({ id: "range", items, itemSize: 40, initialViewportSize: 240 });
  const onRange = (range: ListRange) => log.set([...log().slice(-4), `${range.start}–${range.end}`]);
  return (
    <section class="stack">
      <p class="buttons">
        <button id="range-shrink" type="button" onClick={() => items.set(make(20))}>
          Shrink to 20
        </button>
        <button id="range-grow" type="button" onClick={() => items.set(make(2000))}>
          Grow to 2000
        </button>
      </p>
      <CdkVirtualScrollViewport state={state} class="viewport" label="Items" onRenderedRangeChange={onRange}>
        {(item, ctx) => (
          <div class="row" data-index={ctx.index()}>
            {item()}
          </div>
        )}
      </CdkVirtualScrollViewport>
      {/* state.range is a signal: the server-rendered range, then the engine's. */}
      <output id="range-state">
        range {state.range().start}–{state.range().end} of {items().length}
      </output>
      <output id="range-log">onRenderedRangeChange: {log().join(", ")}</output>
    </section>
  );
}
// #endregion
