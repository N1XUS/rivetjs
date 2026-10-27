// Rivet-authored Resizable demo (editor-style nested groups; section from HeroUI Pro's public Resizable docs).
import { Icon } from "@rivetjs/kit/icon";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@rivetjs/ui/resizable";
import { FileCode, Folder, SquareTerminal } from "lucide";

export const head = { title: "Resizable: Nested groups" };

// #region demo
export function ResizableNested() {
  return (
    <ResizablePanelGroup id="editor" orientation="horizontal" class="min-h-[320px] w-full max-w-2xl rounded-xl border border-separator">
      <ResizablePanel id="explorer" defaultSize="25%" minSize="15%" class="bg-surface">
        <div class="flex items-center gap-2 p-4 text-sm font-medium">
          <Icon icon={Folder} size={16} />
          Explorer
        </div>
      </ResizablePanel>
      <ResizableHandle id="explorer-handle" variant="secondary" aria-label="Resize explorer" />
      <ResizablePanel id="workspace" defaultSize="75%">
        <ResizablePanelGroup id="workspace-group" orientation="vertical">
          <ResizablePanel id="code" defaultSize="65%" minSize="30%">
            <div class="flex items-center gap-2 p-4 text-sm font-medium">
              <Icon icon={FileCode} size={16} />
              index.tsx
            </div>
          </ResizablePanel>
          <ResizableHandle id="terminal-handle" type="pill" aria-label="Resize terminal" />
          <ResizablePanel id="terminal" defaultSize="35%" minSize="15%" class="bg-surface-secondary">
            <div class="flex items-center gap-2 p-4 text-sm font-medium text-muted">
              <Icon icon={SquareTerminal} size={16} />
              Terminal
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
      <ResizableNested />
    </div>
  );
}
