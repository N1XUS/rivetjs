// Rivet-authored ContextMenu demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Header } from "@rivetjs/ui/header";
import { ContextMenu } from "@rivetjs/ui/context-menu";

export const head = { title: "ContextMenu: With Sections" };

// #region demo
export function WithSections() {
  return (
    <div id="cm-sections" class="flex flex-col items-center gap-3">
      <ContextMenu>
        <ContextMenu.Trigger class="flex h-40 w-72 items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted select-none">
          Right click here
        </ContextMenu.Trigger>
        <ContextMenu.Popover>
          <ContextMenu.Menu aria-label="Actions">
            <ContextMenu.Section>
              <Header>File</Header>
              <ContextMenu.Item id="new">New file</ContextMenu.Item>
              <ContextMenu.Item id="rename">Rename</ContextMenu.Item>
            </ContextMenu.Section>
            <ContextMenu.Separator />
            <ContextMenu.Section>
              <Header>Danger zone</Header>
              <ContextMenu.Item id="delete" variant="danger">
                Delete
              </ContextMenu.Item>
            </ContextMenu.Section>
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
      <WithSections />
    </div>
  );
}
