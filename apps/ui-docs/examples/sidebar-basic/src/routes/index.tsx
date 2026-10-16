import { Icon } from "@rivetjs/kit/icon";
import { Calendar, House, Inbox, Search, Settings } from "lucide";
import { Sidebar } from "@rivetjs/ui/sidebar";

export const head = { title: "Sidebar" };

const items = [
  { title: "Home", url: "#home", icon: House },
  { title: "Inbox", url: "#inbox", icon: Inbox },
  { title: "Calendar", url: "#calendar", icon: Calendar },
  { title: "Search", url: "#search", icon: Search },
  { title: "Settings", url: "#settings", icon: Settings },
];

// #region demo
export default function SidebarBasic() {
  return (
    <Sidebar.Provider>
      <Sidebar>
        <Sidebar.Content>
          <Sidebar.Group>
            <Sidebar.GroupLabel>Application</Sidebar.GroupLabel>
            <Sidebar.GroupContent>
              <Sidebar.Menu>
                {items.map((item) => (
                  <Sidebar.MenuItem>
                    <Sidebar.MenuButton href={item.url} isActive={item.title === "Home"}>
                      <Icon icon={item.icon} size={16} />
                      <span>{item.title}</span>
                    </Sidebar.MenuButton>
                  </Sidebar.MenuItem>
                ))}
              </Sidebar.Menu>
            </Sidebar.GroupContent>
          </Sidebar.Group>
        </Sidebar.Content>
      </Sidebar>
      <Sidebar.Inset>
        <header class="flex h-12 items-center gap-2 px-4">
          <Sidebar.Trigger id="sbb-trigger" />
          <span class="text-sm font-medium">Home</span>
        </header>
      </Sidebar.Inset>
    </Sidebar.Provider>
  );
}
// #endregion
