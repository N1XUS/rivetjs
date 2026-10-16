import { sheetMotion, type SheetMotionController } from "@rivetjs/cdk/sheet-motion";

export const head = { title: "sheetMotion: drag, snap and dismiss an edge sheet" };

// #region demo
export default function SheetMotionDemo() {
  const sheet: { current?: SheetMotionController } = {};
  const open = () => {
    const el = document.getElementById("sheet")!;
    el.setAttribute("data-open", "true");
    el.removeAttribute("data-settled");
    // Numbers in, transform out: the gesture writes an inline translateY; snap points are lengths or viewport fractions.
    sheet.current = sheetMotion(el, {
      placement: "bottom",
      snapPoints: ["96px", "220px"],
      activeSnapIndex: 1,
      handle: "[data-handle]",
      onSettle: (isOpen) => el.setAttribute("data-settled", isOpen ? String(Math.round(sheet.current!.offset())) : "closed"),
      close: () => {
        sheet.current?.destroy();
        sheet.current = undefined;
        el.removeAttribute("data-open");
        el.style.transform = "";
      },
    });
  };
  return (
    <div class="relative h-full min-h-72 overflow-hidden bg-slate-50 text-sm">
      <div class="flex gap-2 p-4">
        <button id="open" type="button" class="rounded-md border border-slate-300 bg-white px-3 py-1" onClick={() => sheet.current || open()}>
          Open
        </button>
        <button id="peek" type="button" class="rounded-md border border-slate-300 bg-white px-3 py-1" onClick={() => sheet.current?.snapTo(0)}>
          Peek
        </button>
        <button id="expand" type="button" class="rounded-md border border-slate-300 bg-white px-3 py-1" onClick={() => sheet.current?.snapTo(1)}>
          Expand
        </button>
        <button id="dismiss" type="button" class="rounded-md border border-slate-300 bg-white px-3 py-1" onClick={() => sheet.current?.dismiss()}>
          Dismiss
        </button>
      </div>
      <div id="sheet" class="absolute inset-x-0 bottom-0 hidden h-[220px] rounded-t-2xl border border-slate-200 bg-white shadow-lg data-[open=true]:block">
        <div data-handle class="flex cursor-grab touch-none justify-center py-3">
          <div class="h-1.5 w-10 rounded-full bg-slate-300" />
        </div>
        <p class="px-4 text-slate-600">Drag the handle: release near a snap point, or flick down to dismiss.</p>
      </div>
    </div>
  );
}
// #endregion
