// Rivet-authored Resizable demo: port of the shadcn/ui "resizable-handle" example (MIT, © shadcn; modified: Rivet JSX, HeroUI look).
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@rivetjs/ui/resizable";

export const head = { title: "Resizable: Handle" };

// #region demo
export function ResizableHandleDemo() {
  return (
    <ResizablePanelGroup orientation="horizontal" class="min-h-[200px] max-w-md rounded-xl border border-separator md:min-w-[450px]">
      <ResizablePanel id="sidebar" defaultSize="25%">
        <div class="flex h-full items-center justify-center p-6">
          <span class="font-semibold">Sidebar</span>
        </div>
      </ResizablePanel>
      <ResizableHandle id="handle" withHandle />
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
      <ResizableHandleDemo />
    </div>
  );
}
