// Rivet-authored Command demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { Button } from "@rivetjs/ui/button";
import { Command } from "@rivetjs/ui/command";
import { Kbd } from "@rivetjs/ui/kbd";
import { Calculator, Calendar, CreditCard, Search, Settings, Smile, User } from "lucide";

export const head = { title: "Command: Usage" };

// #region demo
export function Basic() {
  const open = signal(false);
  const ran = signal("nothing yet");
  return (
    <div id="cmd-basic" class="flex flex-col items-center gap-3">
      <Command isOpen={open}>
        <Button id="cmd-basic-open" variant="secondary">
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
                <Command.Group heading="Suggestions">
                  <Command.Item id="calendar" icon={Calendar}>
                    Calendar
                  </Command.Item>
                  <Command.Item id="search-emoji" icon={Smile}>
                    Search emoji
                  </Command.Item>
                  <Command.Item id="calculator" icon={Calculator}>
                    Calculator
                  </Command.Item>
                </Command.Group>
                <Command.Separator />
                <Command.Group heading="Settings">
                  <Command.Item id="profile" icon={User} shortcut="command+P">
                    Profile
                  </Command.Item>
                  <Command.Item id="billing" icon={CreditCard} shortcut="command+B">
                    Billing
                  </Command.Item>
                  <Command.Item id="settings" icon={Settings} shortcut="command+S">
                    Settings
                  </Command.Item>
                </Command.Group>
              </Command.List>
              <Command.Footer>
                <span class="flex items-center gap-1">
                  <Kbd>
                    <Kbd.Abbr keyValue="up" />
                  </Kbd>
                  <Kbd>
                    <Kbd.Abbr keyValue="down" />
                  </Kbd>
                  to navigate
                </span>
                <span class="flex items-center gap-1">
                  <Kbd>
                    <Kbd.Abbr keyValue="enter" />
                  </Kbd>
                  to run
                </span>
                <span class="flex items-center gap-1">
                  <Kbd>
                    <Kbd.Content>esc</Kbd.Content>
                  </Kbd>
                  to close
                </span>
              </Command.Footer>
            </Command.Dialog>
          </Command.Container>
        </Command.Backdrop>
      </Command>
      <p id="cmd-basic-ran" class="text-sm text-muted">
        Ran: {ran}
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
