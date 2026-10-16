import { Icon } from "@rivetjs/kit/icon";
import { ChartLine, House, Inbox, Settings } from "lucide";
import { Sidebar } from "@rivetjs/ui/sidebar";

export const head = { title: "Sidebar: menu button sizes and outline" };

// #region demo
export default function SidebarMenuButtons() {
  return (
    <Sidebar.Provider>
      <Sidebar collapsible="none" class="h-svh">
        <Sidebar.Content>
          <Sidebar.Group>
            <Sidebar.GroupLabel>Sizes</Sidebar.GroupLabel>
            <Sidebar.Menu>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton size="sm" href="#small">
                  <Icon icon={Inbox} size={16} />
                  <span>Small</span>
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton id="sbm-active" href="#default" isActive>
                  <Icon icon={House} size={16} />
                  <span>Default (active)</span>
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton size="lg" href="#large">
                  <Icon icon={ChartLine} size={16} />
                  <div class="flex flex-col">
                    <span class="font-medium">Large</span>
                    <span class="text-xs text-muted">Two lines fit</span>
                  </div>
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
            </Sidebar.Menu>
          </Sidebar.Group>
          <Sidebar.Separator />
          <Sidebar.Group>
            <Sidebar.GroupLabel>Outline</Sidebar.GroupLabel>
            <Sidebar.Menu>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton variant="outline" href="#settings">
                  <Icon icon={Settings} size={16} />
                  <span>Settings</span>
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
