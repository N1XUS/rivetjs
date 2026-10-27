// Rivet-authored Resizable demo (collapsible panel + imperative handle; section from HeroUI Pro's public Resizable docs).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup, usePanelRef } from "@rivetjs/ui/resizable";

export const head = { title: "Resizable: Collapsible panels" };

// #region demo
export function ResizableCollapsible() {
  const nav = usePanelRef();
  const collapsed = signal(false);
  return (
    <div class="flex w-full max-w-xl flex-col gap-3">
      <div class="flex items-center gap-3">
        <Button id="toggle-nav" size="sm" variant="secondary" onPress={() => (nav.current?.isCollapsed() ? nav.current.expand() : nav.current?.collapse())}>
          Toggle navigation
        </Button>
        <output id="nav-state" class="text-sm text-muted">
          {collapsed() ? "Collapsed" : "Expanded"}
        </output>
      </div>
      <ResizablePanelGroup orientation="horizontal" class="min-h-[200px] rounded-xl border border-separator">
        <ResizablePanel
          id="nav"
          defaultSize="30%"
          minSize="20%"
          collapsible
          collapsedSize="48px"
          panelRef={nav}
          onResize={(size) => collapsed.set(size.inPixels <= 48)}
          class="bg-surface"
        >
          <div class="p-4 text-sm font-medium">Navigation</div>
        </ResizablePanel>
        <ResizableHandle id="nav-handle" withIndicator aria-label="Resize navigation" />
        <ResizablePanel id="page">
          <div class="flex h-full items-center justify-center p-4 text-sm text-muted">Drag the handle past the minimum, or press Enter on it.</div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ResizableCollapsible />
    </div>
  );
}
