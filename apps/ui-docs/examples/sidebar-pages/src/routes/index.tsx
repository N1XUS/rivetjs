import { signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { ArrowLeft, Bell, ChevronRight, CreditCard, House, Inbox, Lock, Palette, Settings } from "lucide";
import { Sidebar, useSidebarPages } from "@rivetjs/ui/sidebar";

export const head = { title: "Sidebar: pages" };

/** A menu button that shows another page (drill in / back). */
function PageLink(props: { id: string; to: string; label: string; icon: typeof House; back?: boolean }) {
  const pages = useSidebarPages();
  const to = props.to;
  return (
    <Sidebar.MenuItem>
      <Sidebar.MenuButton id={props.id} closeMobileOnAction={false} onPress={() => pages.setActiveValue(to)}>
        <Icon icon={props.icon} size={16} />
        <span>{props.label}</span>
        {props.back ? null : <Icon icon={ChevronRight} size={16} class="ms-auto text-muted" />}
      </Sidebar.MenuButton>
    </Sidebar.MenuItem>
  );
}

// #region demo
export default function SidebarPagesDemo() {
  const active = signal("main");
  return (
    <Sidebar.Provider>
      <Sidebar>
        <Sidebar.Content>
          <Sidebar.Pages value={active}>
            <Sidebar.Page value="main" aria-label="Main">
              <Sidebar.Group>
                <Sidebar.GroupLabel>Main</Sidebar.GroupLabel>
                <Sidebar.Menu>
                  <Sidebar.MenuItem>
                    <Sidebar.MenuButton href="#home" isCurrent>
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
                  <PageLink id="sp-settings" to="settings" label="Settings" icon={Settings} />
                </Sidebar.Menu>
              </Sidebar.Group>
            </Sidebar.Page>
            <Sidebar.Page value="settings" aria-label="Settings">
              <Sidebar.Group>
                <Sidebar.Menu>
                  <PageLink id="sp-back" to="main" label="Back" icon={ArrowLeft} back />
                </Sidebar.Menu>
              </Sidebar.Group>
              <Sidebar.Group>
                <Sidebar.GroupLabel>Settings</Sidebar.GroupLabel>
                <Sidebar.Menu>
                  <Sidebar.MenuItem>
                    <Sidebar.MenuButton href="#appearance">
                      <Icon icon={Palette} size={16} />
                      <span>Appearance</span>
                    </Sidebar.MenuButton>
                  </Sidebar.MenuItem>
                  <Sidebar.MenuItem>
                    <Sidebar.MenuButton href="#notifications">
                      <Icon icon={Bell} size={16} />
                      <span>Notifications</span>
                    </Sidebar.MenuButton>
                  </Sidebar.MenuItem>
                  <Sidebar.MenuItem>
                    <Sidebar.MenuButton href="#billing">
                      <Icon icon={CreditCard} size={16} />
                      <span>Billing</span>
                    </Sidebar.MenuButton>
                  </Sidebar.MenuItem>
                  <Sidebar.MenuItem>
                    <Sidebar.MenuButton href="#security">
                      <Icon icon={Lock} size={16} />
                      <span>Security</span>
                    </Sidebar.MenuButton>
                  </Sidebar.MenuItem>
                </Sidebar.Menu>
              </Sidebar.Group>
            </Sidebar.Page>
          </Sidebar.Pages>
        </Sidebar.Content>
      </Sidebar>
      <Sidebar.Inset>
        <header class="flex h-12 items-center gap-2 px-4">
          <Sidebar.Trigger />
          <span class="text-sm text-muted">
            Page: <span id="sp-active">{active()}</span>
          </span>
        </header>
      </Sidebar.Inset>
    </Sidebar.Provider>
  );
}
// #endregion
