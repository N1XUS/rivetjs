import { Icon } from "@rivetjs/kit/icon";
import { House, Keyboard } from "lucide";
import { Kbd } from "@rivetjs/ui/kbd";
import { Sidebar } from "@rivetjs/ui/sidebar";

export const head = { title: "Sidebar: keyboard shortcut" };

// #region demo
export default function SidebarShortcut() {
  return (
    <Sidebar.Provider toggleShortcut="mod+shift+s">
      <Sidebar>
        <Sidebar.Content>
          <Sidebar.Group>
            <Sidebar.Menu>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton id="ssc-home" href="#home" isCurrent>
                  <Icon icon={House} size={16} />
                  <span>Home</span>
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton href="#shortcuts">
                  <Icon icon={Keyboard} size={16} />
                  <span>Shortcuts</span>
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
            </Sidebar.Menu>
          </Sidebar.Group>
        </Sidebar.Content>
      </Sidebar>
      <Sidebar.Inset>
        <header class="flex h-12 items-center gap-2 px-4 text-sm text-muted">
          <Sidebar.Trigger />
          <span>Toggle with</span>
          <Kbd>
            <Kbd.Abbr keyValue="command" />
            <Kbd.Abbr keyValue="shift" />
            <Kbd.Content>S</Kbd.Content>
          </Kbd>
        </header>
      </Sidebar.Inset>
    </Sidebar.Provider>
  );
}
// #endregion
