// Sidebar resize handle (Rivet extension, `resizable`) on a resumed page: `#sr-wrapper` Provider (`onOpenChange` log
// `#sr-log`), `collapsible="icon"` panel `#sr-panel` with `resizable minWidth="200px" maxWidth="400px"`, live width
// (`onWidthChange`) → `#sr-width`, committed width (`onWidthChangeEnd`) → `#sr-end`, menu button `#sr-home`, trigger
// `#sr-trigger` in the inset. Handle: `[data-slot=sidebar-resize-handle]`.
import { signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { House, Inbox } from "lucide";
import { Sidebar } from "@rivetjs/ui/sidebar";

export const head = { title: "Sidebar resize" };

export default function SidebarResizeStories() {
  const log = signal("");
  const width = signal("");
  const end = signal("");
  return (
    <Sidebar.Provider id="sr-wrapper" onOpenChange={(open) => log.set(log() + (open ? "o" : "c"))}>
      <Sidebar
        id="sr-panel"
        collapsible="icon"
        resizable
        minWidth="200px"
        maxWidth="400px"
        onWidthChange={(w) => width.set(String(w))}
        onWidthChangeEnd={(w) => end.set(String(w))}
      >
        <Sidebar.Content>
          <Sidebar.Group>
            <Sidebar.Menu>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton id="sr-home" href="#home" isActive tooltip="Home">
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
          </Sidebar.Group>
        </Sidebar.Content>
      </Sidebar>
      <Sidebar.Inset>
        <header class="flex h-12 items-center gap-2 px-4">
          <Sidebar.Trigger id="sr-trigger" />
          <output id="sr-width">{width()}</output>
          <output id="sr-end">{end()}</output>
          <output id="sr-log">{log()}</output>
        </header>
      </Sidebar.Inset>
    </Sidebar.Provider>
  );
}
