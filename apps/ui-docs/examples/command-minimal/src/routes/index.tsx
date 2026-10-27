// Rivet-authored Command demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { Button } from "@rivetjs/ui/button";
import { Command } from "@rivetjs/ui/command";
import { Search } from "lucide";

export const head = { title: "Command: Minimal" };

// #region demo
export function Minimal() {
  const open = signal(false);
  const ran = signal("nothing yet");
  return (
    <div id="cmd-minimal" class="flex flex-col items-center gap-3">
      <Command isOpen={open}>
        <Button id="cmd-minimal-open" variant="secondary">
          Go to…
        </Button>
        <Command.Backdrop variant="transparent">
          <Command.Container size="sm">
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
                <Command.Item id="inbox">Inbox</Command.Item>
                <Command.Item id="drafts">Drafts</Command.Item>
                <Command.Item id="sent">Sent</Command.Item>
                <Command.Item id="archive">Archive</Command.Item>
              </Command.List>
            </Command.Dialog>
          </Command.Container>
        </Command.Backdrop>
      </Command>
      <p id="cmd-minimal-ran" class="text-sm text-muted">
        Ran: {ran}
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Minimal />
    </div>
  );
}
