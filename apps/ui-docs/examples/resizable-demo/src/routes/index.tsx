// Rivet-authored Resizable demo: port of the shadcn/ui "resizable-demo" example (MIT, © shadcn; modified: Rivet JSX, HeroUI look).
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@rivetjs/ui/resizable";

export const head = { title: "Resizable: Demo" };

// #region demo
export function ResizableDemo() {
  return (
    <ResizablePanelGroup orientation="horizontal" class="max-w-md rounded-xl border border-separator md:min-w-[450px]">
      <ResizablePanel id="one" defaultSize="50%">
        <div class="flex h-[200px] items-center justify-center p-6">
          <span class="font-semibold">One</span>
        </div>
      </ResizablePanel>
      <ResizableHandle id="handle-one" />
      <ResizablePanel id="right" defaultSize="50%">
        <ResizablePanelGroup orientation="vertical">
          <ResizablePanel id="two" defaultSize="25%">
            <div class="flex h-full items-center justify-center p-6">
              <span class="font-semibold">Two</span>
            </div>
          </ResizablePanel>
          <ResizableHandle id="handle-two" />
          <ResizablePanel id="three" defaultSize="75%">
            <div class="flex h-full items-center justify-center p-6">
              <span class="font-semibold">Three</span>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ResizableDemo />
    </div>
  );
}
