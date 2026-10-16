import { signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { House, Inbox } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { Sidebar } from "@rivetjs/ui/sidebar";

export const head = { title: "Sidebar: controlled" };

// #region demo
export default function SidebarControlled() {
  const open = signal(true);
  return (
    <Sidebar.Provider open={open}>
      <Sidebar>
        <Sidebar.Content>
          <Sidebar.Group>
            <Sidebar.Menu>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton href="#home" isActive>
                  <Icon icon={House} size={16} />
                  <span>Home</span>
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton href="#inbox">
                  <Icon icon={Inbox} size={16} />
                  <span>Inbox</span>
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
            </Sidebar.Menu>
          </Sidebar.Group>
        </Sidebar.Content>
      </Sidebar>
      <Sidebar.Inset>
        <div class="flex items-center gap-3 p-4 text-sm">
          <Sidebar.Trigger id="sbc-trigger" />
          <Button id="sbc-toggle" size="sm" variant="secondary" onPress={() => open.set(!open())}>
            Toggle from outside
          </Button>
          <span>
            Sidebar is <output id="sbc-state">{open() ? "open" : "closed"}</output>
          </span>
        </div>
      </Sidebar.Inset>
    </Sidebar.Provider>
  );
}
// #endregion
