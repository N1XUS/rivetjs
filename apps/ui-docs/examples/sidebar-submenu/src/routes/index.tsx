import { Icon } from "@rivetjs/kit/icon";
import { Ellipsis, Folder, Plus } from "lucide";
import { Sidebar } from "@rivetjs/ui/sidebar";

export const head = { title: "Sidebar: sub menus, actions and badges" };

// #region demo
export default function SidebarSubmenu() {
  return (
    <Sidebar.Provider>
      <Sidebar collapsible="none" class="h-svh">
        <Sidebar.Content>
          <Sidebar.Group>
            <Sidebar.GroupLabel>Projects</Sidebar.GroupLabel>
            <Sidebar.GroupAction aria-label="Add project">
              <Icon icon={Plus} size={16} />
            </Sidebar.GroupAction>
            <Sidebar.Menu>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton href="#projects">
                  <Icon icon={Folder} size={16} />
                  <span>Projects</span>
                </Sidebar.MenuButton>
                <Sidebar.MenuBadge>12</Sidebar.MenuBadge>
                <Sidebar.MenuAction showOnHover aria-label="More">
                  <Icon icon={Ellipsis} size={16} />
                </Sidebar.MenuAction>
                <Sidebar.MenuSub>
                  <Sidebar.MenuSubItem>
                    <Sidebar.MenuSubButton id="sbs-design" href="#design" isActive>
                      Design
                    </Sidebar.MenuSubButton>
                  </Sidebar.MenuSubItem>
                  <Sidebar.MenuSubItem>
                    <Sidebar.MenuSubButton href="#marketing">Marketing</Sidebar.MenuSubButton>
                  </Sidebar.MenuSubItem>
                  <Sidebar.MenuSubItem>
                    <Sidebar.MenuSubButton href="#travel">Travel</Sidebar.MenuSubButton>
                  </Sidebar.MenuSubItem>
                </Sidebar.MenuSub>
              </Sidebar.MenuItem>
            </Sidebar.Menu>
          </Sidebar.Group>
        </Sidebar.Content>
      </Sidebar>
    </Sidebar.Provider>
  );
}
// #endregion
