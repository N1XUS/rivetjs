// Rivet-authored Resizable demo (`withIndicator` + a composed `ResizableIndicator`; independent implementation).
import { ResizableHandle, ResizableIndicator, ResizablePanel, ResizablePanelGroup } from "@rivetjs/ui/resizable";

export const head = { title: "Resizable: With indicator" };

// #region demo
export function ResizableWithIndicator() {
  return (
    <ResizablePanelGroup orientation="vertical" class="min-h-[280px] max-w-md rounded-xl border border-separator md:min-w-[450px]">
      <ResizablePanel id="top" defaultSize="50%">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel id="files" defaultSize="35%">
            <div class="flex h-full items-center justify-center p-4 text-sm">Files</div>
          </ResizablePanel>
          <ResizableHandle id="files-handle" withIndicator aria-label="Resize files" />
          <ResizablePanel id="preview" defaultSize="65%">
            <div class="flex h-full items-center justify-center p-4 text-sm">Preview</div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>
      <ResizableHandle id="console-handle" aria-label="Resize console">
        <ResizableIndicator type="pill" />
      </ResizableHandle>
      <ResizablePanel id="console" defaultSize="50%">
        <div class="flex h-full items-center justify-center p-4 text-sm text-muted">Console</div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ResizableWithIndicator />
    </div>
  );
}
