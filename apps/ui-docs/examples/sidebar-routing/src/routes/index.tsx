import { signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { CreditCard, ExternalLink, Globe, House } from "lucide";
import { Sidebar } from "@rivetjs/ui/sidebar";

export const head = { title: "Sidebar: client-side routing" };

// #region demo
export default function SidebarRouting() {
  // Stand-in for a router's location; with @rivetjs/router you can omit `navigate`.
  const path = signal("/");
  return (
    <Sidebar.Provider navigate={(href) => path.set(href)}>
      <Sidebar>
        <Sidebar.Content>
          <Sidebar.Group>
            <Sidebar.Menu>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton href="/" isCurrent={() => path() === "/"}>
                  <Icon icon={House} size={16} />
                  <span>Home</span>
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton id="srt-billing" href="/billing" isCurrent={() => path() === "/billing"}>
                  <Icon icon={CreditCard} size={16} />
                  <span>Billing</span>
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton id="srt-legacy" href="/legacy" forceReload>
                  <Icon icon={Globe} size={16} />
                  <span>Legacy app</span>
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton id="srt-status" href="https://status.example.com/">
                  <Icon icon={ExternalLink} size={16} />
                  <span>Status page</span>
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
            </Sidebar.Menu>
          </Sidebar.Group>
        </Sidebar.Content>
      </Sidebar>
      <Sidebar.Inset>
        <header class="flex h-12 items-center gap-2 px-4 text-sm text-muted">
          <Sidebar.Trigger />
          <span>
            Path: <code id="srt-path">{path()}</code>
          </span>
        </header>
      </Sidebar.Inset>
    </Sidebar.Provider>
  );
}
// #endregion
