import { signal } from "@rivetjs/reactivity";
import { Virtualizer, ListLayout } from "@rivetjs/cdk/virtualizer";

export const head = { title: "Virtualizer: DOM events" };

const rows = Array.from({ length: 1000 }, (_, i) => i);

// #region demo
export default function Events() {
  const log = signal<string[]>([]);
  // Consecutive duplicates (scroll, wheel) are logged once.
  const add = (entry: string) => log.set(log().at(-1) === entry ? log() : [...log(), entry]);
  return (
    <section class="stack">
      <Virtualizer
        id="events-list"
        role="list"
        label="Rows"
        tabIndex={0}
        lang="en"
        translate="no"
        items={rows}
        layout={() => new ListLayout()}
        layoutOptions={{ rowSize: 32 }}
        initialSize={{ width: 320, height: 200 }}
        style={{ width: "320px", height: "200px" }}
        onPointerEnter={() => add("pointerenter")}
        onPointerDown={() => add("pointerdown")}
        onClick={() => add("click")}
        onWheel={() => add("wheel")}
        onScroll={() => add("scroll")}
      >
        {(n) => (
          <div role="listitem" class="row">
            Row {n()}
          </div>
        )}
      </Virtualizer>
      <output id="events-log">{log().join(" ") || "No events yet"}</output>
    </section>
  );
}
// #endregion
