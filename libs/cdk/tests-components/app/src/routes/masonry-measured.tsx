// Measured masonry on a resumed page (unknown heights): CSS columns first paint, then the client effect (`watchMeasured`)
// places items by their measured heights (`data-measured`) — this mode boots one effect by design. `#more` appends
// notes after resume (the observers place them: one node per item, none left in the flow).
import { signal } from "@rivetjs/reactivity";
import { Masonry } from "@rivetjs/cdk/masonry";

const note = (i: number) => ({ id: i, lines: 1 + ((i * 5) % 4) });

export default function MasonryMeasured() {
  const notes = signal(Array.from({ length: 9 }, (_, i) => note(i)));
  return (
    <>
      <button id="more" onClick={() => notes.set([...notes(), ...Array.from({ length: 6 }, (_, i) => note(notes().length + i))])}>
        More
      </button>
      <Masonry id="notes" items={notes} columns={3} gap={10} aria-label="Notes" style={{ width: "600px" }}>
        {(item) => <div style={{ height: `${item.lines * 30}px` }}>{`note ${item.id}`}</div>}
      </Masonry>
    </>
  );
}
