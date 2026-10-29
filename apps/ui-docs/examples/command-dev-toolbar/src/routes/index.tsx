// Rivet-authored Command demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { Button } from "@rivetjs/ui/button";
import { Command } from "@rivetjs/ui/command";
import { Kbd } from "@rivetjs/ui/kbd";
import { Bug, GitBranch, Play, RefreshCw, Search, Terminal } from "lucide";

export const head = { title: "Command: Dev Toolbar" };

// #region demo
export function DevToolbar() {
  const open = signal(false);
  const ran = signal("nothing yet");
  return (
    <div id="cmd-dev" class="flex flex-col items-center gap-3">
      <Command isOpen={open}>
        <Button id="cmd-dev-open" variant="secondary">
          Developer tools
        </Button>
        <Command.Backdrop>
          <Command.Container size="lg">
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
                <Command.Group heading="Run">
                  <Command.Item id="dev" icon={Play} description="Start the dev server on port 5173" shortcut="command+shift+D">
                    Start dev server
                  </Command.Item>
                  <Command.Item id="test" icon={Bug} description="Watch mode, changed files only" shortcut="command+shift+T">
                    Run tests
                  </Command.Item>
                  <Command.Item id="rebuild" icon={RefreshCw} description="Clear the cache and rebuild">
                    Rebuild
                  </Command.Item>
                </Command.Group>
                <Command.Group heading="Tools">
                  <Command.Item id="terminal" icon={Terminal} shortcut="ctrl+`">
                    Toggle terminal
                  </Command.Item>
                  <Command.Item id="branch" icon={GitBranch} description="main · 3 commits ahead">
                    Switch branch
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
      <p id="cmd-dev-ran" class="text-sm text-muted">
        Ran: {ran}
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <DevToolbar />
    </div>
  );
}
