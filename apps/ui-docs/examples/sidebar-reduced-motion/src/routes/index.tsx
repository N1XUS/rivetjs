import { Icon } from "@rivetjs/kit/icon";
import { FileText, Folder } from "lucide";
import { Sidebar } from "@rivetjs/ui/sidebar";

export const head = { title: "Sidebar: reduced motion" };

// #region demo
export default function SidebarReducedMotion() {
  return (
    <Sidebar.Provider reduceMotion>
      <Sidebar>
        <Sidebar.Content>
          <Sidebar.Group>
            <Sidebar.Menu>
              <Sidebar.MenuItem expandable>
                <Sidebar.MenuTrigger id="srm-files">
                  <Icon icon={Folder} size={16} />
                  <span>Files</span>
                  <Sidebar.MenuIndicator />
                </Sidebar.MenuTrigger>
                <Sidebar.MenuSub>
                  <Sidebar.MenuSubItem>
                    <Sidebar.MenuSubButton href="#notes">
                      <Icon icon={FileText} size={16} />
                      <span>Notes</span>
                    </Sidebar.MenuSubButton>
                  </Sidebar.MenuSubItem>
                </Sidebar.MenuSub>
              </Sidebar.MenuItem>
            </Sidebar.Menu>
          </Sidebar.Group>
        </Sidebar.Content>
      </Sidebar>
      <Sidebar.Inset>
        <header class="flex h-12 items-center gap-2 px-4">
          <Sidebar.Trigger id="srm-trigger" />
          <span class="text-sm text-muted">Everything switches instantly.</span>
        </header>
      </Sidebar.Inset>
    </Sidebar.Provider>
  );
}
// #endregion
