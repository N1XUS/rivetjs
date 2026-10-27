// Rivet-authored ContextMenu demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { ContextMenu } from "@rivetjs/ui/context-menu";

export const head = { title: "ContextMenu: Disabled" };

// #region demo
export function Disabled() {
  return (
    <div id="cm-disabled" class="flex flex-wrap items-center justify-center gap-4">
      <ContextMenu isDisabled>
        <ContextMenu.Trigger class="flex h-32 w-56 items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted">
          Browser menu
        </ContextMenu.Trigger>
        <ContextMenu.Popover>
          <ContextMenu.Menu aria-label="Actions">
            <ContextMenu.Item id="never">Never shown</ContextMenu.Item>
          </ContextMenu.Menu>
        </ContextMenu.Popover>
      </ContextMenu>
      <ContextMenu>
        <ContextMenu.Trigger
          id="cm-disabled-items"
          class="flex h-32 w-56 items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted"
        >
          Some items disabled
        </ContextMenu.Trigger>
        <ContextMenu.Popover>
          <ContextMenu.Menu aria-label="Actions" disabledKeys={["paste"]}>
            <ContextMenu.Item id="cut">Cut</ContextMenu.Item>
            <ContextMenu.Item id="copy">Copy</ContextMenu.Item>
            <ContextMenu.Item id="paste">Paste</ContextMenu.Item>
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
      <Disabled />
    </div>
  );
}
