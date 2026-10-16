import { signal } from "@rivetjs/reactivity";
import { Virtualizer, ListLayout } from "@rivetjs/cdk/virtualizer";

export const head = { title: "Virtualizer: variable row heights" };

const notes = Array.from({ length: 2000 }, (_, i) => ({ id: i, text: `Note ${i}`, tall: i % 3 === 0 }));

// #region demo
export default function Notes() {
  const grown = signal(false);
  return (
    <section class="stack">
      <button id="grow" type="button" aria-pressed={String(grown())} onClick={() => grown.set(!grown())}>
        Grow note 2
      </button>
      <Virtualizer
        id="notes"
        role="list"
        label="Notes"
        tabIndex={0}
        items={notes}
        layout={() => new ListLayout()}
        layoutOptions={{ estimatedRowSize: 32 }}
        shouldObserveItemSize
        initialSize={{ width: 320, height: 240 }}
        style={{ width: "320px", height: "240px" }}
      >
        {(note) => (
          <div role="listitem" class="note" style={{ height: note().id === 2 && grown() ? "96px" : note().tall ? "64px" : "32px" }}>
            {note().text}
            {note().tall ? " (tall)" : ""}
          </div>
        )}
      </Virtualizer>
    </section>
  );
}
// #endregion
