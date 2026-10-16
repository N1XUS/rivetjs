import { signal } from "@rivetjs/reactivity";
import { Virtualizer, ListLayout } from "@rivetjs/cdk/virtualizer";

export const head = { title: "Virtualizer: fixed rows" };

const rows = Array.from({ length: 10000 }, (_, i) => i);

// #region demo
export default function Rows() {
  const top = signal(0);
  return (
    <section class="stack">
      <p class="buttons">
        <button id="rows-first" type="button" onClick={() => (document.getElementById("rows")!.scrollTop = 0)}>
          Top
        </button>
        <button
          id="rows-bottom"
          type="button"
          onClick={() => {
            const scroller = document.getElementById("rows")!;
            scroller.scrollTop = scroller.scrollHeight;
          }}
        >
          Bottom
        </button>
      </p>
      <Virtualizer
        id="rows"
        role="list"
        label="Rows"
        tabIndex={0}
        items={rows}
        layout={() => new ListLayout()}
        layoutOptions={{ rowSize: 32 }}
        initialSize={{ width: 320, height: 240 }}
        style={{ width: "320px", height: "240px" }}
        onScroll={(event) => top.set((event.currentTarget as HTMLElement).scrollTop)}
      >
        {(n) => (
          <div role="listitem" class="row">
            Row {n()}
          </div>
        )}
      </Virtualizer>
      <output id="rows-top">scrollTop: {top()}</output>
    </section>
  );
}
// #endregion
