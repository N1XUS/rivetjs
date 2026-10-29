// Rivet-authored ContextMenu demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { ContextMenu } from "@rivetjs/ui/context-menu";

export const head = { title: "ContextMenu: Long Press" };

// #region demo
export function LongPress() {
  return (
    <div id="cm-long-press" class="flex flex-col items-center gap-3">
      <ContextMenu>
        <ContextMenu.Trigger class="flex h-40 w-72 items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted select-none">
          Long press or right click
        </ContextMenu.Trigger>
        <ContextMenu.Popover>
          <ContextMenu.Menu aria-label="Actions">
            <ContextMenu.Item id="save">Save image</ContextMenu.Item>
            <ContextMenu.Item id="copy">Copy image</ContextMenu.Item>
            <ContextMenu.Item id="share">Share…</ContextMenu.Item>
          </ContextMenu.Menu>
        </ContextMenu.Popover>
      </ContextMenu>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <LongPress />
    </div>
  );
}
