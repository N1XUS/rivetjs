import { ResizableHandle, ResizableIndicator, ResizablePanel, ResizablePanelGroup } from "@rivetjs/ui/resizable";

export const head = { title: "Resizable handles" };

// UI-PORT-C story: handle types (`line` / `drag` / `pill` / `handle`), separator-token variants, `withIndicator`, a
// composed `ResizableIndicator`, and the CSS variables overridden on one group (`#rz-vars`).
const TYPES = ["line", "drag", "pill", "handle"] as const;
const BOX = { width: "480px", height: "96px" };

export default function ResizableHandles() {
  return (
    <main class="flex flex-col gap-4 p-6">
      {TYPES.map((type) => (
        <ResizablePanelGroup id={`rz-${type}`} class="rounded-xl border border-separator" style={BOX}>
          <ResizablePanel id={`rz-${type}-a`} defaultSize="50%">
            {type}
          </ResizablePanel>
          <ResizableHandle id={`rz-${type}-h`} type={type} aria-label={type} />
          <ResizablePanel id={`rz-${type}-b`}>b</ResizablePanel>
        </ResizablePanelGroup>
      ))}
      <ResizablePanelGroup id="rz-tertiary" class="rounded-xl bg-surface-tertiary" style={BOX}>
        <ResizablePanel id="rz-tertiary-a" defaultSize="50%">
          tertiary
        </ResizablePanel>
        <ResizableHandle id="rz-tertiary-h" variant="tertiary" withIndicator aria-label="tertiary" />
        <ResizablePanel id="rz-tertiary-b">b</ResizablePanel>
      </ResizablePanelGroup>
      <ResizablePanelGroup id="rz-vertical" orientation="vertical" class="rounded-xl border border-separator" style={{ ...BOX, height: "192px" }}>
        <ResizablePanel id="rz-vertical-a" defaultSize="50%">
          top
        </ResizablePanel>
        <ResizableHandle id="rz-vertical-h" aria-label="vertical">
          <ResizableIndicator type="pill" />
        </ResizableHandle>
        <ResizablePanel id="rz-vertical-b">bottom</ResizablePanel>
      </ResizablePanelGroup>
      <ResizablePanelGroup
        id="rz-vars"
        class="rounded-xl border border-separator"
        style={{ ...BOX, "--resizable-handle-size": "4px", "--resizable-indicator-pill-height": "48px" }}
      >
        <ResizablePanel id="rz-vars-a" defaultSize="50%">
          vars
        </ResizablePanel>
        <ResizableHandle id="rz-vars-h" type="pill" aria-label="vars" />
        <ResizablePanel id="rz-vars-b">b</ResizablePanel>
      </ResizablePanelGroup>
    </main>
  );
}
