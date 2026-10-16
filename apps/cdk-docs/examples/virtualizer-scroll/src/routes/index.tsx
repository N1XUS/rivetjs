import { signal } from "@rivetjs/reactivity";
import { Virtualizer, ListLayout } from "@rivetjs/cdk/virtualizer";

export const head = { title: "Virtualizer: programmatic scroll" };

const entries = Array.from({ length: 5000 }, (_, i) => i);
const ROW = 32;

// #region demo
export default function Log() {
  const top = signal(0);
  // Scroll the scroller element: its scroll event renders the new window.
  const scrollTo = (y: number) => {
    document.getElementById("log")!.scrollTop = y;
  };
  return (
    <section class="stack">
      <p class="buttons">
        <button id="to-top" type="button" onClick={() => scrollTo(0)}>
          Top
        </button>
        <button id="to-500" type="button" onClick={() => scrollTo(500 * ROW)}>
          Row 500
        </button>
        <button id="to-end" type="button" onClick={() => scrollTo(entries.length * ROW)}>
          Bottom
        </button>
      </p>
      <Virtualizer
        id="log"
        label="Log"
        tabIndex={0}
        items={entries}
        persistedKeys={[0]}
        layout={() => new ListLayout()}
        layoutOptions={{ rowSize: ROW }}
        initialSize={{ width: 320, height: 240 }}
        style={{ width: "320px", height: "240px" }}
        onScroll={(event) => top.set((event.currentTarget as HTMLElement).scrollTop)}
      >
        {(n) => (
          <div class="row">
            <button type="button">Entry {n()}</button>
          </div>
        )}
      </Virtualizer>
      <output id="log-top">scrollTop: {top()}</output>
    </section>
  );
}
// #endregion
