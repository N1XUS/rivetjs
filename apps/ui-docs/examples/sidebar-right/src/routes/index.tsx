import { Icon } from "@rivetjs/kit/icon";
import { Bell, Users } from "lucide";
import { Sidebar } from "@rivetjs/ui/sidebar";

export const head = { title: "Sidebar: right side" };

// #region demo
export default function SidebarRight() {
  return (
    <Sidebar.Provider side="right" variant="floating">
      <Sidebar.Inset>
        <header class="flex h-12 items-center justify-end gap-2 px-4">
          <span class="text-sm text-muted">Details panel</span>
          <Sidebar.Trigger id="sr-trigger" />
        </header>
      </Sidebar.Inset>
      <Sidebar>
        <Sidebar.Content>
          <Sidebar.Group>
            <Sidebar.GroupLabel>Details</Sidebar.GroupLabel>
            <Sidebar.Menu>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton href="#members">
                  <Icon icon={Users} size={16} />
                  <span>Members</span>
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton href="#activity">
                  <Icon icon={Bell} size={16} />
                  <span>Activity</span>
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
            </Sidebar.Menu>
          </Sidebar.Group>
        </Sidebar.Content>
      </Sidebar>
    </Sidebar.Provider>
  );
}
// #endregion
