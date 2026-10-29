// Rivet-authored ContextMenu demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import type { Selection } from "@rivetjs/cdk/menu";
import { signal } from "@rivetjs/reactivity";
import { ContextMenu } from "@rivetjs/ui/context-menu";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "ContextMenu: With Selection" };

// #region demo
export function WithSelection() {
  const view = signal<Selection>(new Set(["grid"]));
  return (
    <div id="cm-selection" class="flex flex-col items-center gap-3">
      <ContextMenu>
        <ContextMenu.Trigger class="flex h-40 w-72 items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted select-none">
          Right click to change the view
        </ContextMenu.Trigger>
        <ContextMenu.Popover>
          <ContextMenu.Menu aria-label="View" selectionMode="single" selectedKeys={view}>
            <ContextMenu.Item id="grid" textValue="Grid">
              <ContextMenu.ItemIndicator />
              <Label>Grid</Label>
            </ContextMenu.Item>
            <ContextMenu.Item id="list" textValue="List">
              <ContextMenu.ItemIndicator />
              <Label>List</Label>
            </ContextMenu.Item>
            <ContextMenu.Item id="columns" textValue="Columns">
              <ContextMenu.ItemIndicator />
              <Label>Columns</Label>
            </ContextMenu.Item>
          </ContextMenu.Menu>
        </ContextMenu.Popover>
      </ContextMenu>
      <p id="cm-selection-state" class="text-sm text-muted">
        View: {() => (view() === "all" ? "all" : [...view()].join(", "))}
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <WithSelection />
    </div>
  );
}
