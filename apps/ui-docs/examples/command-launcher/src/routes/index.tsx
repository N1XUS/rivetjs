// Rivet-authored Command demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { Button } from "@rivetjs/ui/button";
import { Command } from "@rivetjs/ui/command";
import { Kbd } from "@rivetjs/ui/kbd";
import { Chip } from "@rivetjs/ui/chip";
import { AppWindow, FileText, Mail, Music, Search } from "lucide";

export const head = { title: "Command: Launcher" };

// #region demo
export function Launcher() {
  const open = signal(false);
  const ran = signal("nothing yet");
  return (
    <div id="cmd-launcher" class="flex flex-col items-center gap-3">
      <Command isOpen={open}>
        <Button id="cmd-launcher-open" variant="secondary">
          Open launcher
        </Button>
        <Command.Backdrop>
          <Command.Container>
            <Command.Dialog>
              <Command.Header>
                <Chip size="sm" variant="soft">
                  All
                </Chip>
                <Chip size="sm" variant="tertiary">
                  Apps
                </Chip>
                <Chip size="sm" variant="tertiary">
                  Files
                </Chip>
              </Command.Header>
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
                <Command.Group heading="Applications">
                  <Command.Item id="mail" icon={Mail}>
                    Mail
                  </Command.Item>
                  <Command.Item id="music" icon={Music}>
                    Music
                  </Command.Item>
                  <Command.Item id="browser" icon={AppWindow}>
                    Browser
                  </Command.Item>
                </Command.Group>
                <Command.Group heading="Recent files">
                  <Command.Item id="q3" icon={FileText} description="Documents · edited 2 h ago">
                    Q3 planning.md
                  </Command.Item>
                  <Command.Item id="notes" icon={FileText} description="Desktop · edited yesterday">
                    Meeting notes.md
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
      <p id="cmd-launcher-ran" class="text-sm text-muted">
        Ran: {ran}
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Launcher />
    </div>
  );
}
