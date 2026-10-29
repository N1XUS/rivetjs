// Rivet-authored demo (AppLayout is a Rivet addition, own content).
import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
import { Icon } from "@rivetjs/kit/icon";
import { Bell, Bot, ChartColumn, FileText, Headset, House, Inbox, LogOut, MessageSquare, Rocket, Settings, Share2, User } from "lucide";
import { AppLayout } from "@rivetjs/ui/app-layout";
import { Avatar } from "@rivetjs/ui/avatar";
import { Breadcrumbs } from "@rivetjs/ui/breadcrumbs";
import { Button } from "@rivetjs/ui/button";
import { Dropdown } from "@rivetjs/ui/dropdown";
import { Label } from "@rivetjs/ui/label";
import { Sidebar } from "@rivetjs/ui/sidebar";

export const head = { title: "AppLayout: Complex" };

const GROUPS = [
  {
    label: "General",
    links: [
      { id: "home", label: "Home", icon: House, chip: "" },
      { id: "inbox", label: "Inbox", icon: Inbox, chip: "8" },
      { id: "reports", label: "Reports", icon: ChartColumn, chip: "" },
    ],
  },
  {
    label: "Agents",
    links: [
      { id: "research", label: "Research assistant", icon: Bot, chip: "New" },
      { id: "support", label: "Support triage", icon: Headset, chip: "3" },
      { id: "launch", label: "Launch planner", icon: Rocket, chip: "" },
    ],
  },
  {
    label: "Knowledge",
    links: [
      { id: "docs", label: "Docs", icon: FileText, chip: "" },
      { id: "threads", label: "Saved threads", icon: MessageSquare, chip: "24" },
    ],
  },
];

const LINKS = GROUPS.flatMap((group) => group.links.map((link) => ({ ...link, group: group.label })));

function UserMenu() {
  return (
    <Dropdown>
      <Button id="alc-user" variant="ghost" size="sm" isIconOnly aria-label="Account menu">
        <Avatar size="sm" color="accent">
          <Avatar.Fallback>SL</Avatar.Fallback>
        </Avatar>
      </Button>
      <Dropdown.Popover placement="bottom end">
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
  );
}

// #region demo
export function AppLayoutComplex() {
  const current = signal("support");
  const page = () => LINKS.find((link) => link.id === current()) ?? LINKS[0];
  return (
    <AppLayout
      id="app-layout-complex"
      style={{ "--sidebar-width": "15rem" }}
      sidebar={() => (
        <Sidebar>
          <Sidebar.Header>
            <Sidebar.Menu>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton size="lg" tooltip="Halcyon AI">
                  <Avatar size="sm">
                    <Avatar.Fallback>HA</Avatar.Fallback>
                  </Avatar>
                  <span class="flex flex-col leading-tight">
                    <span class="font-medium">Halcyon AI</span>
                    <span class="text-xs text-muted">Business plan</span>
                  </span>
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
            </Sidebar.Menu>
          </Sidebar.Header>
          <Sidebar.Content>
            {GROUPS.map((group) => (
              <Sidebar.Group>
                <Sidebar.GroupLabel>{group.label}</Sidebar.GroupLabel>
                <Sidebar.Menu>
                  {group.links.map((link) => (
                    <Sidebar.MenuItem>
                      <Sidebar.MenuButton
                        id={"alc-" + link.id}
                        size="sm"
                        href={"#" + link.id}
                        tooltip={link.label}
                        isCurrent={() => current() === link.id}
                        onPress={() => current.set(link.id)}
                      >
                        <Icon icon={link.icon} size={16} />
                        <span>{link.label}</span>
                      </Sidebar.MenuButton>
                      {link.chip ? (
                        <Sidebar.MenuChip id={"alc-chip-" + link.id} color={link.chip === "New" ? "success" : "accent"}>
                          {link.chip}
                        </Sidebar.MenuChip>
                      ) : null}
                    </Sidebar.MenuItem>
                  ))}
                </Sidebar.Menu>
              </Sidebar.Group>
            ))}
          </Sidebar.Content>
          <Sidebar.Rail />
        </Sidebar>
      )}
      navbar={() => (
        <>
          <AppLayout.MenuToggle />
          <Sidebar.Trigger id="alc-trigger" />
          {/* Breadcrumb items are a collection read once: a keyed Show re-creates the trail per page. */}
          <div id="alc-crumbs" class="min-w-0 flex-1">
            <Show keyed when={page()}>
              {(p) => (
                <Breadcrumbs>
                  <Breadcrumbs.Item href="#" class="max-sm:hidden">
                    Halcyon AI
                  </Breadcrumbs.Item>
                  <Breadcrumbs.Item href="#" class="max-sm:hidden">
                    {p().group}
                  </Breadcrumbs.Item>
                  <Breadcrumbs.Item>{p().label}</Breadcrumbs.Item>
                </Breadcrumbs>
              )}
            </Show>
          </div>
          <Button variant="ghost" size="sm" isIconOnly aria-label="Notifications">
            <Icon icon={Bell} size={16} />
          </Button>
          <Button size="sm" variant="secondary" aria-label="Share">
            <Icon icon={Share2} size={16} />
            <span class="max-sm:hidden">Share</span>
          </Button>
          <UserMenu />
        </>
      )}
    >
      <div class="flex flex-col gap-3 p-6">
        <h1 id="alc-title" class="text-xl font-semibold">
          {() => page().label}
        </h1>
        <p class="max-w-prose text-sm leading-6 text-muted">
          Pick a page in the sidebar: the breadcrumb trail and this heading follow it. Collapse the sidebar to icons with the trigger or Cmd/Ctrl+B.
        </p>
      </div>
    </AppLayout>
  );
}
// #endregion

export default function Demo() {
  return <AppLayoutComplex />;
}
