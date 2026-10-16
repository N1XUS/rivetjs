import { Icon } from "@rivetjs/kit/icon";
import { Calendar, House, Inbox, Settings } from "lucide";
import { Sidebar } from "@rivetjs/ui/sidebar";

export const head = { title: "Sidebar: collapsible to icons" };

// #region demo
export default function SidebarIcon() {
  return (
    <Sidebar.Provider>
      <Sidebar collapsible="icon">
        <Sidebar.Content>
          <Sidebar.Group>
            <Sidebar.GroupLabel>Application</Sidebar.GroupLabel>
            <Sidebar.Menu>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton href="#home" isActive tooltip="Home">
                  <Icon icon={House} size={16} />
                  <span>Home</span>
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton id="sbi-inbox" href="#inbox" tooltip="Inbox">
                  <Icon icon={Inbox} size={16} />
                  <span>Inbox</span>
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton href="#calendar" tooltip="Calendar">
                  <Icon icon={Calendar} size={16} />
                  <span>Calendar</span>
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton href="#settings" tooltip="Settings">
                  <Icon icon={Settings} size={16} />
                  <span>Settings</span>
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
            </Sidebar.Menu>
          </Sidebar.Group>
        </Sidebar.Content>
        <Sidebar.Rail />
      </Sidebar>
      <Sidebar.Inset>
        <header class="flex h-12 items-center gap-2 px-4">
          <Sidebar.Trigger id="sbi-trigger" />
          <span class="text-sm text-muted">Collapse the sidebar, then hover an icon.</span>
        </header>
      </Sidebar.Inset>
    </Sidebar.Provider>
  );
}
// #endregion
