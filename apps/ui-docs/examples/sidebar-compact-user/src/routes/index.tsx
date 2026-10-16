import { Icon } from "@rivetjs/kit/icon";
import { Bell, ChevronsUpDown, House, LogOut, Search, Settings, User } from "lucide";
import { Avatar } from "@rivetjs/ui/avatar";
import { Dropdown } from "@rivetjs/ui/dropdown";
import { Label } from "@rivetjs/ui/label";
import { Sidebar } from "@rivetjs/ui/sidebar";

export const head = { title: "Sidebar: compact with a user menu" };

// #region demo
export default function SidebarCompactUser() {
  return (
    <Sidebar.Provider collapsible="icon">
      <Sidebar>
        <Sidebar.Header>
          <Sidebar.Menu>
            <Sidebar.MenuItem>
              <Sidebar.MenuButton size="lg" tooltip="Acme">
                <Avatar size="sm" color="accent">
                  <Avatar.Fallback>AC</Avatar.Fallback>
                </Avatar>
                <span class="font-medium">Acme</span>
              </Sidebar.MenuButton>
            </Sidebar.MenuItem>
          </Sidebar.Menu>
        </Sidebar.Header>
        <Sidebar.Content>
          <Sidebar.Group>
            <Sidebar.Menu>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton id="scu-home" href="#home" isCurrent tooltip="Home">
                  <Icon icon={House} size={16} />
                  <span>Home</span>
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton href="#search" tooltip="Search">
                  <Icon icon={Search} size={16} />
                  <span>Search</span>
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton href="#notifications" tooltip="Notifications">
                  <Icon icon={Bell} size={16} />
                  <span>Notifications</span>
                </Sidebar.MenuButton>
                <Sidebar.MenuChip color="danger">3</Sidebar.MenuChip>
              </Sidebar.MenuItem>
            </Sidebar.Menu>
          </Sidebar.Group>
        </Sidebar.Content>
        <Sidebar.Footer>
          <Sidebar.Menu>
            <Sidebar.MenuItem>
              <Dropdown>
                <Sidebar.MenuButton id="scu-user" size="lg" aria-label="Account menu">
                  <Avatar size="sm">
                    <Avatar.Fallback>MK</Avatar.Fallback>
                  </Avatar>
                  <span class="flex flex-col leading-tight">
                    <span class="font-medium">Mira Kovač</span>
                    <span class="text-xs text-muted">mira@acme.test</span>
                  </span>
                  <Icon icon={ChevronsUpDown} size={16} class="ms-auto" />
                </Sidebar.MenuButton>
                <Dropdown.Popover placement="right bottom">
                  <Dropdown.Menu aria-label="Account">
                    <Dropdown.Item id="profile" textValue="Profile">
                      <Icon icon={User} size={16} />
                      <Label>Profile</Label>
                    </Dropdown.Item>
                    <Dropdown.Item id="settings" textValue="Settings">
                      <Icon icon={Settings} size={16} />
                      <Label>Settings</Label>
                    </Dropdown.Item>
                    <Dropdown.Item id="logout" textValue="Log out">
                      <Icon icon={LogOut} size={16} />
                      <Label>Log out</Label>
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
            </Sidebar.MenuItem>
          </Sidebar.Menu>
        </Sidebar.Footer>
        <Sidebar.Rail />
      </Sidebar>
      <Sidebar.Inset>
        <header class="flex h-12 items-center gap-2 px-4">
          <Sidebar.Trigger id="scu-trigger" />
          <span class="text-sm text-muted">collapsible="icon" set once on the provider.</span>
        </header>
      </Sidebar.Inset>
    </Sidebar.Provider>
  );
}
// #endregion
