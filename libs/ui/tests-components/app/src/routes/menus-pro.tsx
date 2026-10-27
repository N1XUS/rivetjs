import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Command } from "@rivetjs/ui/command";
import { ContextMenu } from "@rivetjs/ui/context-menu";

export const head = { title: "ContextMenu / Command" };

// Rivet additions (feature sets inspired by HeroUI Pro's public docs): right-click menu at the pointer and a command palette —
// each resumes on its first input.
export default function MenusPro() {
  const last = signal("none");
  const open = signal(false);
  return (
    <main class="flex flex-col gap-8 bg-background p-6 text-foreground">
      <ContextMenu>
        <ContextMenu.Trigger id="cm" class="flex h-32 w-72 items-center justify-center rounded-xl border border-dashed border-border">
          Right click here
        </ContextMenu.Trigger>
        <ContextMenu.Popover>
          <ContextMenu.Menu aria-label="Edit" onAction={(k) => last.set(String(k))}>
            <ContextMenu.Item id="copy">Copy</ContextMenu.Item>
            <ContextMenu.Item id="paste">Paste</ContextMenu.Item>
            <ContextMenu.Separator />
            <ContextMenu.Item id="delete" variant="danger">
              Delete
            </ContextMenu.Item>
          </ContextMenu.Menu>
        </ContextMenu.Popover>
      </ContextMenu>
      <p id="cm-last">{last}</p>
      <Command isOpen={open}>
        <Button id="cmd-open" variant="secondary">
          Open palette
        </Button>
        <Command.Backdrop>
          <Command.Container>
            <Command.Dialog>
              <Command.InputGroup>
                <Command.InputGroup.Input />
                <Command.InputGroup.ClearButton />
              </Command.InputGroup>
              <Command.List
                onAction={(k) => {
                  last.set("cmd:" + String(k));
                  open.set(false);
                }}
              >
                <Command.Group heading="Settings">
                  <Command.Item id="profile">Profile</Command.Item>
                  <Command.Item id="billing" textValue="Billing money invoices">
                    Billing
                  </Command.Item>
                </Command.Group>
              </Command.List>
            </Command.Dialog>
          </Command.Container>
        </Command.Backdrop>
      </Command>
    </main>
  );
}
