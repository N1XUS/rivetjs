// Rivet-authored Command demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { Button } from "@rivetjs/ui/button";
import { Command } from "@rivetjs/ui/command";
import { CreditCard, Search, Settings, Users } from "lucide";

export const head = { title: "Command: Multiple Search Terms" };

// #region demo
export function MultipleSearchTerms() {
  const open = signal(false);
  const ran = signal("nothing yet");
  return (
    <div id="cmd-terms" class="flex flex-col items-center gap-3">
      <Command isOpen={open}>
        <Button id="cmd-terms-open" variant="secondary">
          Open command palette
        </Button>
        <Command.Backdrop>
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
                <Command.Item id="settings" icon={Settings} textValue="Settings preferences options configuration">
                  Settings
                </Command.Item>
                <Command.Item id="billing" icon={CreditCard} textValue="Billing money invoices payment plan">
                  Billing
                </Command.Item>
                <Command.Item id="team" icon={Users} textValue="Team members people invite">
                  Team
                </Command.Item>
              </Command.List>
            </Command.Dialog>
          </Command.Container>
        </Command.Backdrop>
      </Command>
      <p id="cmd-terms-ran" class="text-sm text-muted">
        Ran: {ran}
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <MultipleSearchTerms />
    </div>
  );
}
