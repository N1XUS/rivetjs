import { ScrollArea, ScrollAreaCorner, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport } from "@rivetjs/cdk/scroll-area";

export const head = { title: "ScrollArea: Tailwind" };

const CELLS = Array.from({ length: 12 * 12 }, (_, i) => i + 1);

// #region demo
export default function ScrollAreaTailwind() {
  return (
    <ScrollArea id="grid" type="always" class="m-6 size-64 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <ScrollAreaViewport class="size-full">
        <div class="grid w-max grid-cols-12 gap-2 p-3">
          {CELLS.map((cell) => (
            <div class="grid size-14 place-items-center rounded-md bg-indigo-50 text-sm font-medium text-indigo-700">{cell}</div>
          ))}
        </div>
      </ScrollAreaViewport>
      {(["vertical", "horizontal"] as const).map((orientation) => (
        <ScrollAreaScrollbar
          id={"grid-scrollbar-" + (orientation === "vertical" ? "y" : "x")}
          orientation={orientation}
          class="flex touch-none select-none bg-slate-100 p-0.5 transition-colors hover:bg-slate-200 data-[orientation=horizontal]:h-2.5 data-[orientation=horizontal]:flex-col data-[orientation=vertical]:w-2.5"
        >
          <ScrollAreaThumb id={"grid-thumb-" + (orientation === "vertical" ? "y" : "x")} class="relative flex-1 rounded-full bg-slate-400 hover:bg-slate-500" />
        </ScrollAreaScrollbar>
      ))}
      <ScrollAreaCorner id="grid-corner" class="bg-slate-100" />
    </ScrollArea>
  );
}
// #endregion
