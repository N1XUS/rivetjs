import { signal } from "@rivetjs/reactivity";
import { moveProps } from "@rivetjs/cdk/interactions/move";

export const head = { title: "moveProps" };

const clamp = (v: number) => Math.min(160, Math.max(0, v));

// #region demo
export default function Pad() {
  const x = signal(40);
  const y = signal(40);
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((l) => [...l.slice(-2), entry]);
  const move = moveProps({
    onMoveStart: (e) => log.set([`movestart:${e.pointerType}`]),
    onMove: (e) => {
      // Keyboard deltas are ±1: scale them; pointer deltas are pixels.
      const step = e.pointerType === "keyboard" ? (e.shiftKey ? 50 : 10) : 1;
      x.update((v) => clamp(v + e.deltaX * step));
      y.update((v) => clamp(v + e.deltaY * step));
      add(`move:${e.pointerType}(${e.deltaX},${e.deltaY})`);
    },
    onMoveEnd: (e) => add(`moveend:${e.pointerType}`),
  });
  return (
    <section class="m-4 grid gap-3 text-sm">
      <div class="relative h-[184px] w-[184px] rounded-md border border-slate-300 bg-slate-50">
        <div
          id="handle"
          role="button"
          tabIndex={0}
          aria-label="Move the dot"
          {...move.moveProps}
          class="absolute h-6 w-6 cursor-grab touch-none rounded-full bg-teal-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          style={{ left: `${x()}px`, top: `${y()}px` }}
        ></div>
      </div>
      <p id="pos">
        x {x()}, y {y()}
      </p>
      <output id="log" class="block font-mono text-xs">
        {log().join(" ") || "none"}
      </output>
    </section>
  );
}
// #endregion
