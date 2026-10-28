import { signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { House, Inbox, Settings } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { Sidebar } from "@rivetjs/ui/sidebar";

export const head = { title: "Sidebar: variants and side" };

// #region demo
export default function SidebarVariants() {
  const variant = signal<"sidebar" | "floating" | "inset">("sidebar");
  const side = signal<"left" | "right">("left");
  return (
    <Sidebar.Provider>
      <Sidebar variant={variant} side={side}>
        <Sidebar.Header>
          <span class="px-2 text-sm font-semibold in-data-[collapsible=icon]:hidden">Acme</span>
        </Sidebar.Header>
        <Sidebar.Content>
          <Sidebar.Group>
            <Sidebar.Menu>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton href="#home" isActive>
                  <Icon icon={House} size={16} />
                  <span>Home</span>
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton href="#inbox">
                  <Icon icon={Inbox} size={16} />
                  <span>Inbox</span>
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton href="#settings">
                  <Icon icon={Settings} size={16} />
                  <span>Settings</span>
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
            </Sidebar.Menu>
          </Sidebar.Group>
        </Sidebar.Content>
      </Sidebar>
      <Sidebar.Inset>
        <div class="flex flex-wrap items-center gap-2 p-4">
          <Sidebar.Trigger />
          <Button id="sbv-sidebar" size="sm" variant="secondary" onPress={() => variant.set("sidebar")}>
            sidebar
          </Button>
          <Button id="sbv-floating" size="sm" variant="secondary" onPress={() => variant.set("floating")}>
            floating
          </Button>
          <Button id="sbv-inset" size="sm" variant="secondary" onPress={() => variant.set("inset")}>
            inset
          </Button>
          <Button id="sbv-side" size="sm" variant="tertiary" onPress={() => side.set(side() === "left" ? "right" : "left")}>
            Switch side
          </Button>
        </div>
      </Sidebar.Inset>
    </Sidebar.Provider>
  );
}
// #endregion
