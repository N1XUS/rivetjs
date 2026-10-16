import { signal } from "@rivetjs/reactivity";
import { ref } from "@rivetjs/runtime/dom";
import { scrollWheelProps } from "@rivetjs/cdk/interactions/scroll-wheel";

export const head = { title: "scrollWheelProps" };

// #region demo
export default function Zoomable() {
  const zoom = signal(100);
  const box = ref<HTMLDivElement>();
  // With a ref: a non-passive wheel listener on the element (client effect), so preventDefault
  // keeps the page from scrolling even on the first wheel turn.
  scrollWheelProps({ onScroll: (e) => zoom.update((z) => Math.min(400, Math.max(25, z - Math.sign(e.deltaY) * 10))) }, box);
  return (
    <section class="m-4 grid gap-3 text-sm">
      <div id="zoomable" ref={box} class="grid h-24 w-48 place-items-center overflow-hidden rounded-md border border-slate-300 bg-slate-50">
        <span class="font-semibold text-teal-800" style={{ scale: String(zoom() / 100) }}>
          Wheel me
        </span>
      </div>
      <output id="zoom">Zoom {zoom()}%</output>
    </section>
  );
}
// #endregion
