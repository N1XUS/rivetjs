import { signal } from "@rivetjs/reactivity";
import { moveProps } from "@rivetjs/cdk/interactions/move";

export const head = { title: "Move" };

export default function MoveStory() {
  const x = signal(0);
  const events = signal<string[]>([]);
  const move = moveProps({
    onMoveStart: (e) => events.update((l) => [...l, "start:" + e.pointerType]),
    onMove: (e) => x.update((v) => v + e.deltaX),
    onMoveEnd: (e) => events.update((l) => [...l, "end:" + e.pointerType]),
  });
  return (
    <section>
      <div id="handle" tabIndex={0} {...move.moveProps} style={{ width: "50px", height: "50px", background: "#ccc", "touch-action": "none" }}>
        drag
      </div>
      <p id="x">{x()}</p>
      <p id="move-log">{events().join(" ")}</p>
    </section>
  );
}
