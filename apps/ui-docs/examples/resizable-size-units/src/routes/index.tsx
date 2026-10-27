// Rivet-authored Resizable demo (CSS-unit sizes + `groupResizeBehavior`; section from HeroUI Pro's public Resizable docs).
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@rivetjs/ui/resizable";

export const head = { title: "Resizable: Size units" };

// #region demo
export function ResizableSizeUnits() {
  return (
    <ResizablePanelGroup orientation="horizontal" class="min-h-[200px] w-full max-w-2xl rounded-xl border border-separator">
      <ResizablePanel id="units-sidebar" defaultSize="240px" minSize="12rem" maxSize="360px" groupResizeBehavior="preserve-pixel-size">
        <div class="flex h-full flex-col justify-center gap-1 p-4 text-sm">
          <span class="font-semibold">Sidebar</span>
          <span class="text-muted">240px, 12rem to 360px, keeps its pixel width</span>
        </div>
      </ResizablePanel>
      <ResizableHandle id="units-handle" withIndicator aria-label="Resize sidebar" />
      <ResizablePanel id="units-main" minSize="30%">
        <div class="flex h-full flex-col justify-center gap-1 p-4 text-sm">
          <span class="font-semibold">Main</span>
          <span class="text-muted">At least 30%, takes the rest</span>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ResizableSizeUnits />
    </div>
  );
}
