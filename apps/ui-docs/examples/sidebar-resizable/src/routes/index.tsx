import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { Calendar, House, Inbox, Settings } from "lucide";
import { Sidebar } from "@rivetjs/ui/sidebar";

export const head = { title: "Sidebar: resizable" };

// #region demo
export default function SidebarResizable() {
  const width = signal(256);
  return (
    <Sidebar.Provider>
      <Sidebar collapsible="icon" resizable minWidth="12rem" maxWidth="24rem" onWidthChange={(w) => width.set(w)}>
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
                <Sidebar.MenuButton href="#inbox" tooltip="Inbox">
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
      </Sidebar>
      <Sidebar.Inset>
        <header class="flex h-12 items-center gap-2 px-4">
          <Sidebar.Trigger id="sbr-trigger" />
          <span class="text-sm text-muted">
            Drag the sidebar edge (<output id="sbr-width">{width()}px</output>), or focus it and use the arrow keys. Drag it narrow to collapse to icons,
            double-click to reset.
          </span>
        </header>
      </Sidebar.Inset>
    </Sidebar.Provider>
  );
}
// #endregion
