import { signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { BookOpen, LayoutDashboard, Plus, Rocket, Star, Users } from "lucide";
import { Sidebar } from "@rivetjs/ui/sidebar";

export const head = { title: "Sidebar: groups" };

// #region demo
export default function SidebarGroups() {
  const current = signal("dashboard");
  const item = (id: string, label: string, icon: typeof Star) => (
    <Sidebar.MenuItem>
      <Sidebar.MenuButton id={"sg-" + id} href={"#" + id} isCurrent={() => current() === id} onPress={() => current.set(id)}>
        <Icon icon={icon} size={16} />
        <span>{label}</span>
      </Sidebar.MenuButton>
    </Sidebar.MenuItem>
  );
  return (
    <Sidebar.Provider>
      <Sidebar>
        <Sidebar.Content>
          <Sidebar.Group>
            <Sidebar.GroupLabel>Platform</Sidebar.GroupLabel>
            <Sidebar.Menu>
              {item("dashboard", "Dashboard", LayoutDashboard)}
              {item("deploys", "Deploys", Rocket)}
              {item("team", "Team", Users)}
            </Sidebar.Menu>
          </Sidebar.Group>
          <Sidebar.Group>
            <Sidebar.GroupLabel>Resources</Sidebar.GroupLabel>
            <Sidebar.GroupAction aria-label="Add resource">
              <Icon icon={Plus} size={16} />
            </Sidebar.GroupAction>
            <Sidebar.Menu>{item("docs", "Documentation", BookOpen)}</Sidebar.Menu>
          </Sidebar.Group>
          <Sidebar.Group closeMobileOnAction={false}>
            <Sidebar.GroupLabel>Pinned</Sidebar.GroupLabel>
            <Sidebar.Menu>{item("starred", "Starred", Star)}</Sidebar.Menu>
          </Sidebar.Group>
        </Sidebar.Content>
      </Sidebar>
      <Sidebar.Inset>
        <header class="flex h-12 items-center gap-2 px-4">
          <Sidebar.Trigger />
          <span class="text-sm text-muted">Current: {current()}</span>
        </header>
      </Sidebar.Inset>
    </Sidebar.Provider>
  );
}
// #endregion
