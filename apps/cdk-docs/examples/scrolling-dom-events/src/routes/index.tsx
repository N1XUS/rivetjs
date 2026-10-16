import { signal } from "@rivetjs/reactivity";
import { createVirtualScroll, CdkVirtualScrollViewport } from "@rivetjs/cdk/scrolling";
import "@rivetjs/cdk/scrolling.css";

export const head = { title: "Virtual scroll: DOM events" };

const items = Array.from({ length: 500 }, (_, i) => `Item #${i}`);

// #region demo
export default function Events() {
  const log = signal<string[]>([]);
  // Consecutive duplicates (scroll, wheel) are logged once.
  const add = (entry: string) => log.set(log().at(-1) === entry ? log() : [...log(), entry]);
  const state = createVirtualScroll({ id: "dom-vp", items, itemSize: 40, initialViewportSize: 240 });
  return (
    <section class="stack">
      <CdkVirtualScrollViewport
        state={state}
        class="viewport"
        label="Items"
        lang="en"
        onPointerEnter={() => add("pointerenter")}
        onPointerDown={() => add("pointerdown")}
        onClick={() => add("click")}
        onWheel={() => add("wheel")}
        onScroll={() => add("scroll")}
      >
        {(item, ctx) => (
          <div class="row" data-index={ctx.index()}>
            {item()}
          </div>
        )}
      </CdkVirtualScrollViewport>
      <output id="dom-log">{log().join(" ") || "No events yet"}</output>
    </section>
  );
}
// #endregion
