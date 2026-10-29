// Rivet-authored ContextMenu demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Label } from "@rivetjs/ui/label";
import { ContextMenu } from "@rivetjs/ui/context-menu";

export const head = { title: "ContextMenu: With Submenus" };

// #region demo
export function WithSubmenus() {
  return (
    <div id="cm-submenus" class="flex flex-col items-center gap-3">
      <ContextMenu>
        <ContextMenu.Trigger class="flex h-40 w-72 items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted select-none">
          Right click here
        </ContextMenu.Trigger>
        <ContextMenu.Popover>
          <ContextMenu.Menu aria-label="Actions">
            <ContextMenu.Item id="copy">Copy</ContextMenu.Item>
            <ContextMenu.SubmenuTrigger>
              <ContextMenu.Item id="share" textValue="Share">
                <Label>Share</Label>
                <ContextMenu.SubmenuIndicator />
              </ContextMenu.Item>
              <ContextMenu.Popover>
                <ContextMenu.Menu aria-label="Share">
                  <ContextMenu.Item id="email">Email</ContextMenu.Item>
                  <ContextMenu.Item id="messages">Messages</ContextMenu.Item>
                  <ContextMenu.Item id="link">Copy link</ContextMenu.Item>
                </ContextMenu.Menu>
              </ContextMenu.Popover>
            </ContextMenu.SubmenuTrigger>
            <ContextMenu.Item id="archive">Archive</ContextMenu.Item>
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
      <WithSubmenus />
    </div>
  );
}
