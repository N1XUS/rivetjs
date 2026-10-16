import { Icon } from "@rivetjs/kit/icon";
import { BookOpen, FileText, Folder } from "lucide";
import { Sidebar } from "@rivetjs/ui/sidebar";

export const head = { title: "Sidebar: collapsible groups" };

// #region demo
export default function SidebarCollapsibleGroups() {
  return (
    <Sidebar.Provider>
      <Sidebar>
        <Sidebar.Content>
          <Sidebar.Group>
            <Sidebar.GroupLabel>Docs</Sidebar.GroupLabel>
            <Sidebar.Menu showGuideLines="hover">
              <Sidebar.MenuItem defaultExpanded>
                <Sidebar.MenuTrigger id="scg-guides">
                  <Icon icon={BookOpen} size={16} />
                  <span>Guides</span>
                  <Sidebar.MenuIndicator />
                </Sidebar.MenuTrigger>
                <Sidebar.MenuSub>
                  <Sidebar.MenuSubItem>
                    <Sidebar.MenuSubButton href="#start" isCurrent>
                      Getting started
                    </Sidebar.MenuSubButton>
                  </Sidebar.MenuSubItem>
                  <Sidebar.MenuSubItem>
                    <Sidebar.MenuSubButton href="#deploy">Deploying</Sidebar.MenuSubButton>
                  </Sidebar.MenuSubItem>
                </Sidebar.MenuSub>
              </Sidebar.MenuItem>
              <Sidebar.MenuItem expandable>
                <Sidebar.MenuTrigger id="scg-api">
                  <Icon icon={Folder} size={16} />
                  <span>API</span>
                  <Sidebar.MenuIndicator />
                </Sidebar.MenuTrigger>
                <Sidebar.MenuSub>
                  <Sidebar.MenuSubItem expandable>
                    <Sidebar.MenuTrigger>
                      <span>REST</span>
                      <Sidebar.MenuIndicator />
                    </Sidebar.MenuTrigger>
                    <Sidebar.MenuSub>
                      <Sidebar.MenuSubItem>
                        <Sidebar.MenuSubButton id="scg-endpoints" href="#endpoints">
                          Endpoints
                        </Sidebar.MenuSubButton>
                      </Sidebar.MenuSubItem>
                      <Sidebar.MenuSubItem>
                        <Sidebar.MenuSubButton href="#errors">Errors</Sidebar.MenuSubButton>
                      </Sidebar.MenuSubItem>
                    </Sidebar.MenuSub>
                  </Sidebar.MenuSubItem>
                  <Sidebar.MenuSubItem>
                    <Sidebar.MenuSubButton href="#webhooks">Webhooks</Sidebar.MenuSubButton>
                  </Sidebar.MenuSubItem>
                </Sidebar.MenuSub>
              </Sidebar.MenuItem>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton href="#changelog">
                  <Icon icon={FileText} size={16} />
                  <span>Changelog</span>
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
            </Sidebar.Menu>
          </Sidebar.Group>
        </Sidebar.Content>
      </Sidebar>
      <Sidebar.Inset>
        <header class="flex h-12 items-center gap-2 px-4">
          <Sidebar.Trigger />
          <span class="text-sm text-muted">Hover the menu to see the guide lines.</span>
        </header>
      </Sidebar.Inset>
    </Sidebar.Provider>
  );
}
// #endregion
