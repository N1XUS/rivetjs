// Rivet-authored Resizable demo: port of the shadcn/ui "resizable-vertical" example (MIT, © shadcn; modified: Rivet JSX, HeroUI look).
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@rivetjs/ui/resizable";

export const head = { title: "Resizable: Vertical" };

// #region demo
export function ResizableVertical() {
  return (
    <ResizablePanelGroup orientation="vertical" class="min-h-[200px] max-w-md rounded-xl border border-separator md:min-w-[450px]">
      <ResizablePanel id="header" defaultSize="25%">
        <div class="flex h-full items-center justify-center p-6">
          <span class="font-semibold">Header</span>
        </div>
      </ResizablePanel>
      <ResizableHandle id="handle" />
      <ResizablePanel id="content" defaultSize="75%">
        <div class="flex h-full items-center justify-center p-6">
          <span class="font-semibold">Content</span>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ResizableVertical />
    </div>
  );
}
