// Sidebar (Rivet addition: shadcn/ui behaviour from `@rivetjs/cdk/sidebar`, HeroUI look) on a resumed page: floating
// `collapsible="icon"` panel `#sb-panel` in `#sb-wrapper`, menu buttons `#sb-home` (active, tooltip) / `#sb-inbox`
// (tooltip, `onPress` counter `#sb-pressed`) / `#sb-lg` (size lg + outline), badge, sub button `#sb-sub`, rail `#sb-rail`,
// trigger `#sb-trigger` in the inset, `onOpenChange` log `#sb-log`, separator `#sb-sep`.
import { signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { House, Inbox, Settings } from "lucide";
import { Sidebar } from "@rivetjs/ui/sidebar";

export const head = { title: "Sidebar" };

export default function SidebarStories() {
  const log = signal("");
  const pressed = signal(0);
  return (
    <Sidebar.Provider id="sb-wrapper" onOpenChange={(open) => log.set(log() + (open ? "o" : "c"))}>
      <Sidebar id="sb-panel" variant="floating" collapsible="icon">
        <Sidebar.Header>
          <Sidebar.Input id="sb-input" placeholder="Search" />
        </Sidebar.Header>
        <Sidebar.Separator id="sb-sep" />
        <Sidebar.Content>
          <Sidebar.Group>
            <Sidebar.GroupLabel id="sb-label">Application</Sidebar.GroupLabel>
            <Sidebar.GroupContent>
              <Sidebar.Menu>
                <Sidebar.MenuItem>
                  <Sidebar.MenuButton id="sb-home" href="#home" isActive tooltip="Home">
                    <Icon icon={House} size={16} />
                    <span>Home</span>
                  </Sidebar.MenuButton>
                  <Sidebar.MenuBadge id="sb-badge">24</Sidebar.MenuBadge>
                </Sidebar.MenuItem>
                <Sidebar.MenuItem>
                  <Sidebar.MenuButton id="sb-inbox" tooltip="Inbox" onPress={() => pressed.set(pressed() + 1)}>
                    <Icon icon={Inbox} size={16} />
                    <span>Inbox</span>
                  </Sidebar.MenuButton>
                </Sidebar.MenuItem>
                <Sidebar.MenuItem>
                  <Sidebar.MenuButton id="sb-lg" size="lg" variant="outline">
                    <Icon icon={Settings} size={16} />
                    <span>Settings</span>
                  </Sidebar.MenuButton>
                  <Sidebar.MenuSub>
                    <Sidebar.MenuSubItem>
                      <Sidebar.MenuSubButton id="sb-sub" href="#general">
                        General
                      </Sidebar.MenuSubButton>
                    </Sidebar.MenuSubItem>
                  </Sidebar.MenuSub>
                </Sidebar.MenuItem>
              </Sidebar.Menu>
            </Sidebar.GroupContent>
          </Sidebar.Group>
        </Sidebar.Content>
        <Sidebar.Footer>Footer</Sidebar.Footer>
        <Sidebar.Rail id="sb-rail" />
      </Sidebar>
      <Sidebar.Inset id="sb-inset">
        <Sidebar.Trigger id="sb-trigger" />
        <output id="sb-log">{log()}</output>
        <output id="sb-pressed">{pressed()}</output>
      </Sidebar.Inset>
    </Sidebar.Provider>
  );
}
