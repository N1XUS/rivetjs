import { signal } from "@rivetjs/reactivity";
import { Virtualizer, ListLayout } from "@rivetjs/cdk/virtualizer";

export const head = { title: "Virtualizer: sections" };

interface Entry {
  key: string;
  type: "section" | "header" | "item";
  label: string;
  children?: Entry[];
}

// A section is a node of type "section"; its children are a "header" node and its rows.
const groups: Entry[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter) => ({
  key: letter,
  type: "section",
  label: `Group ${letter}`,
  children: [
    { key: `${letter}-header`, type: "header", label: `Group ${letter}` },
    ...Array.from({ length: 20 }, (_, i): Entry => ({ key: `${letter}-${i}`, type: "item", label: `${letter} person ${i}` })),
  ],
}));

// #region demo
export default function People() {
  const top = signal(0);
  return (
    <section class="stack">
      <button
        id="people-bottom"
        type="button"
        onClick={() => {
          const scroller = document.getElementById("people")!;
          scroller.scrollTop = scroller.scrollHeight;
        }}
      >
        Bottom
      </button>
      <Virtualizer
        id="people"
        label="People"
        tabIndex={0}
        items={groups}
        layout={() => new ListLayout()}
        layoutOptions={{ rowSize: 32, headingSize: 28 }}
        initialSize={{ width: 320, height: 240 }}
        style={{ width: "320px", height: "240px" }}
        onScroll={(event) => top.set((event.currentTarget as HTMLElement).scrollTop)}
      >
        {(entry, view) =>
          view().type === "header" ? <div class="heading">{entry().label}</div> : view().type === "item" ? <div class="row">{entry().label}</div> : null
        }
      </Virtualizer>
      <output id="people-top">scrollTop: {top()}</output>
    </section>
  );
}
// #endregion
