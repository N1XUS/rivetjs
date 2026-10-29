// Rivet-authored Command demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { Button } from "@rivetjs/ui/button";
import { Command } from "@rivetjs/ui/command";
import { FilePlus, FolderOpen, Search, Share2, Trash2 } from "lucide";

export const head = { title: "Command: Clean" };

// #region demo
export function Clean() {
  const open = signal(false);
  const ran = signal("nothing yet");
  return (
    <div id="cmd-clean" class="flex flex-col items-center gap-3">
      <Command isOpen={open}>
        <Button id="cmd-clean-open" variant="secondary">
          Open command palette
        </Button>
        <Command.Backdrop variant="blur">
          <Command.Container>
            <Command.Dialog>
              <Command.InputGroup>
                <Command.InputGroup.Prefix>
                  <Icon icon={Search} size={16} />
                </Command.InputGroup.Prefix>
                <Command.InputGroup.Input />
                <Command.InputGroup.ClearButton />
              </Command.InputGroup>
              <Command.List
                onAction={(key) => {
                  ran.set(String(key));
                  open.set(false);
                }}
              >
                <Command.Item id="new" icon={FilePlus}>
                  New document
                </Command.Item>
                <Command.Item id="open" icon={FolderOpen}>
                  Open…
                </Command.Item>
                <Command.Item id="share" icon={Share2}>
                  Share
                </Command.Item>
                <Command.Separator />
                <Command.Item id="delete" icon={Trash2} variant="danger">
                  Move to trash
                </Command.Item>
              </Command.List>
            </Command.Dialog>
          </Command.Container>
        </Command.Backdrop>
      </Command>
      <p id="cmd-clean-ran" class="text-sm text-muted">
        Ran: {ran}
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Clean />
    </div>
  );
}
