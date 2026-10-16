import { Compare, CompareAfter, CompareBefore, CompareDivider, CompareHandle } from "@rivetjs/cdk/compare";
import { ChevronsLeftRight } from "lucide";
import { Icon } from "../components/Icon.tsx";
import robot from "../assets/robot-face.jpg?url";

export const head = { title: "Compare" };

// #region demo
export default function PhotoCompare() {
  return (
    <section class="m-4 grid place-items-center">
      <Compare id="photo" class="aspect-video w-[min(34rem,100%)] select-none overflow-hidden rounded-2xl bg-slate-200">
        <CompareBefore class="h-full w-full">
          <img src={robot} alt="Knitted robot head, grayscale" class="block h-full w-full object-cover grayscale" draggable={false} />
        </CompareBefore>
        <CompareAfter class="h-full w-full">
          <img src={robot} alt="Knitted robot head, colour" class="block h-full w-full object-cover" draggable={false} />
        </CompareAfter>
        <CompareHandle id="photo-handle" aria-label="Reveal the colour photo" class="group flex w-11 cursor-ew-resize items-center justify-center outline-none">
          <CompareDivider class="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-white shadow" />
          <span class="relative grid size-10 place-items-center rounded-full bg-white text-slate-600 shadow-lg ring-blue-500 transition-transform group-data-dragging:scale-90 group-data-focus-visible:ring-2">
            <Icon icon={ChevronsLeftRight} size={20} />
          </span>
        </CompareHandle>
      </Compare>
    </section>
  );
}
// #endregion
