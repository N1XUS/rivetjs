// AppLayout (Rivet addition; feature set inspired by HeroUI Pro's public AppLayout docs) on a resumed page: `#al` layout with
// a collapsible-icon sidebar (`#al-home`), navbar (`#al-menu` mobile toggle, `#al-aside-trigger`), resizable sidebar + aside
// (`#al-aside`), aside shortcut Mod+Shift+E, `onAsideOpenChange` log `#al-log`, main `#al-main`.
import { signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { House, Inbox } from "lucide";
import { AppLayout } from "@rivetjs/ui/app-layout";
import { Sidebar } from "@rivetjs/ui/sidebar";

export const head = { title: "AppLayout" };

export default function AppLayoutStories() {
  const log = signal("");
  return (
    <AppLayout
      id="al"
      sidebarResizable
      asideResizable
      asideToggleShortcut="mod+shift+e"
      onAsideOpenChange={(open: boolean) => log.set(log() + (open ? "o" : "c"))}
      sidebar={() => (
        <Sidebar id="al-sidebar">
          <Sidebar.Content>
            <Sidebar.Menu>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton id="al-home" href="#home" isActive tooltip="Home">
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
            </Sidebar.Menu>
          </Sidebar.Content>
        </Sidebar>
      )}
      navbar={() => (
        <>
          <AppLayout.MenuToggle />
          <Sidebar.Trigger id="al-sidebar-trigger" />
          <span class="flex-1 font-medium">Dashboard</span>
          <AppLayout.AsideTrigger />
        </>
      )}
      aside={() => <div class="p-4">Details panel</div>}
    >
      <div id="al-main" class="p-6">
        <span id="al-log">{log()}</span>
        <p class="h-[1500px]">Main content</p>
      </div>
    </AppLayout>
  );
}
