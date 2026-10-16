import { signal } from "@rivetjs/reactivity";
import { Compare, CompareAfter, CompareBefore, CompareDivider, CompareHandle } from "@rivetjs/cdk/compare";

export const head = { title: "Compare: controlled" };

// #region demo
export default function ControlledCompare() {
  const split = signal(25);
  const ends = signal(0);
  return (
    <section class="m-4 grid justify-items-center gap-3 text-sm">
      <Compare
        value={split}
        dragAnywhere
        onChangeEnd={() => ends.set(ends() + 1)}
        class="h-48 w-[min(30rem,100%)] cursor-ew-resize select-none overflow-hidden rounded-xl"
      >
        <CompareBefore class="grid h-full place-items-center bg-amber-200 font-medium text-amber-900">Before</CompareBefore>
        <CompareAfter class="grid h-full place-items-center bg-indigo-600 font-medium text-white">After</CompareAfter>
        <CompareHandle id="split-handle" aria-label="Split" class="w-8 outline-none data-focus-visible:bg-white/20">
          <CompareDivider class="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 rounded bg-white" />
        </CompareHandle>
      </Compare>
      <p class="flex gap-4 text-slate-600">
        <span>
          Position: <output id="split-value">{Math.round(split())}%</output>
        </span>
        <span>
          Releases: <output id="split-ends">{ends()}</output>
        </span>
      </p>
      <div class="flex gap-2">
        {[0, 50, 75, 100].map((n) => (
          <button id={`split-${n}`} type="button" class="rounded-md border border-slate-300 px-2 py-1" onClick={() => split.set(n)}>
            {n}%
          </button>
        ))}
      </div>
    </section>
  );
}
// #endregion
