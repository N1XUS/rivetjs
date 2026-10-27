// Rivet-authored Resizable demo (handle types; names from HeroUI Pro's public Resizable docs, independent implementation).
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@rivetjs/ui/resizable";

export const head = { title: "Resizable: Handle types" };

const TYPES = ["line", "drag", "pill", "handle"] as const;

// #region demo
export function ResizableHandleTypes() {
  return (
    <div class="grid w-full max-w-xl gap-4 sm:grid-cols-2">
      {TYPES.map((type) => (
        <ResizablePanelGroup orientation="horizontal" class="min-h-[120px] rounded-xl border border-separator">
          <ResizablePanel id={`${type}-a`} defaultSize="50%">
            <div class="flex h-full items-center justify-center p-4 text-sm text-muted">{type}</div>
          </ResizablePanel>
          <ResizableHandle id={`${type}-handle`} type={type} aria-label={`Resize (${type})`} />
          <ResizablePanel id={`${type}-b`} defaultSize="50%">
            <div class="h-full bg-surface-secondary" />
          </ResizablePanel>
        </ResizablePanelGroup>
      ))}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ResizableHandleTypes />
    </div>
  );
}
