// Rivet-authored ContextMenu demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { signal } from "@rivetjs/reactivity";
import { ContextMenu } from "@rivetjs/ui/context-menu";

export const head = { title: "ContextMenu: Usage" };

// #region demo
export function Basic() {
  const last = signal("none");
  return (
    <div id="cm-basic" class="flex flex-col items-center gap-3">
      <ContextMenu>
        <ContextMenu.Trigger class="flex h-40 w-72 items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted select-none">
          Right click here
        </ContextMenu.Trigger>
        <ContextMenu.Popover>
          <ContextMenu.Menu aria-label="Actions" onAction={(key) => last.set(String(key))}>
            <ContextMenu.Item id="back" shortcut="command+[">
              Back
            </ContextMenu.Item>
            <ContextMenu.Item id="forward" shortcut="command+]">
              Forward
            </ContextMenu.Item>
            <ContextMenu.Item id="reload" shortcut="command+R">
              Reload
            </ContextMenu.Item>
            <ContextMenu.Separator />
            <ContextMenu.Item id="inspect">Inspect</ContextMenu.Item>
          </ContextMenu.Menu>
        </ContextMenu.Popover>
      </ContextMenu>
      <p id="cm-basic-last" class="text-sm text-muted">
        Last action: {last}
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Basic />
    </div>
  );
}
