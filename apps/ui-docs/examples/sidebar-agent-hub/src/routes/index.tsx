// Rivet-authored demo (Sidebar is a Rivet addition: "Agent Hub" section of HeroUI Pro's public docs, own content).
import { signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { Archive, Bot, ChevronsUpDown, Headset, LogOut, MessageSquare, Rocket, Search, Settings, SquarePen, User } from "lucide";
import { Avatar } from "@rivetjs/ui/avatar";
import { Dropdown } from "@rivetjs/ui/dropdown";
import { Label } from "@rivetjs/ui/label";
import { Sidebar } from "@rivetjs/ui/sidebar";

export const head = { title: "Sidebar: agent hub" };

const WORKSPACES = [
  { id: "research", label: "Research", icon: Bot, chip: "4" },
  { id: "support", label: "Support desk", icon: Headset, chip: "12" },
  { id: "launch", label: "Launch team", icon: Rocket, chip: "" },
];

const CHATS = [
  { id: "churn", title: "Summarise churn interviews" },
  { id: "refunds", title: "Draft refund policy reply" },
  { id: "benchmarks", title: "Compare vector database benchmarks" },
  { id: "changelog", title: "Write the October changelog" },
  { id: "pricing", title: "Pricing page A/B test ideas" },
];

// #region demo
export default function SidebarAgentHub() {
  const current = signal("Summarise churn interviews");
  return (
    <Sidebar.Provider collapsible="icon" style={{ "--sidebar-width": "15rem" }}>
      <Sidebar>
        <Sidebar.Header>
          <Sidebar.Menu>
            <Sidebar.MenuItem>
              <Sidebar.MenuButton id="sah-new" size="sm" tooltip="New chat" onPress={() => current.set("New chat")}>
                <Icon icon={SquarePen} size={16} />
                <span>New chat</span>
              </Sidebar.MenuButton>
            </Sidebar.MenuItem>
            <Sidebar.MenuItem>
              <Sidebar.MenuButton size="sm" href="#search" tooltip="Search">
                <Icon icon={Search} size={16} />
                <span>Search</span>
              </Sidebar.MenuButton>
            </Sidebar.MenuItem>
          </Sidebar.Menu>
        </Sidebar.Header>
        <Sidebar.Content>
          <Sidebar.Group>
            <Sidebar.GroupLabel>Workspaces</Sidebar.GroupLabel>
            <Sidebar.Menu>
              {WORKSPACES.map((workspace) => (
                <Sidebar.MenuItem>
                  <Sidebar.MenuButton size="sm" href={"#" + workspace.id} tooltip={workspace.label}>
                    <Icon icon={workspace.icon} size={16} />
                    <span>{workspace.label}</span>
                  </Sidebar.MenuButton>
                  {workspace.chip ? <Sidebar.MenuChip id={"sah-chip-" + workspace.id}>{workspace.chip}</Sidebar.MenuChip> : null}
                </Sidebar.MenuItem>
              ))}
            </Sidebar.Menu>
          </Sidebar.Group>
          <Sidebar.Group class="in-data-[collapsible=icon]:hidden">
            <Sidebar.GroupLabel>Recent chats</Sidebar.GroupLabel>
            <Sidebar.Menu>
              {CHATS.map((chat) => (
                <Sidebar.MenuItem>
                  <Sidebar.MenuButton
                    id={"sah-" + chat.id}
                    size="sm"
                    href={"#" + chat.id}
                    isCurrent={() => current() === chat.title}
                    onPress={() => current.set(chat.title)}
                  >
                    <Icon icon={MessageSquare} size={16} />
                    <span class="truncate">{chat.title}</span>
                  </Sidebar.MenuButton>
                  <Sidebar.MenuAction showOnHover aria-label={"Archive " + chat.title}>
                    <Icon icon={Archive} size={14} />
                  </Sidebar.MenuAction>
                </Sidebar.MenuItem>
              ))}
            </Sidebar.Menu>
          </Sidebar.Group>
        </Sidebar.Content>
        <Sidebar.Footer>
          <Sidebar.Menu>
            <Sidebar.MenuItem>
              <Dropdown>
                <Sidebar.MenuButton id="sah-user" aria-label="Account menu" tooltip="Ada Okafor">
                  <Avatar size="sm" color="accent">
                    <Avatar.Fallback>AO</Avatar.Fallback>
                  </Avatar>
                  <span class="flex flex-col leading-tight">
                    <span class="font-medium">Ada Okafor</span>
                    <span class="text-xs text-muted">Pro plan</span>
                  </span>
                  <Icon icon={ChevronsUpDown} size={16} class="ms-auto" />
                </Sidebar.MenuButton>
                <Dropdown.Popover placement="right bottom">
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
            </Sidebar.MenuItem>
          </Sidebar.Menu>
        </Sidebar.Footer>
        <Sidebar.Rail />
      </Sidebar>
      <Sidebar.Inset>
        <header class="flex h-12 items-center gap-2 border-b border-separator px-4">
          <Sidebar.Trigger id="sah-trigger" />
          <h1 id="sah-title" class="min-w-0 truncate text-sm font-medium">
            {current}
          </h1>
        </header>
        <div class="flex max-w-prose flex-col gap-3 p-6 text-sm leading-6">
          <p class="self-end rounded-2xl bg-surface-secondary px-4 py-2">Which themes came up most often in last week's interviews?</p>
          <p>
            Three themes repeat across the 14 interviews: slow CSV exports (9 mentions), missing SSO on the Team plan (6) and confusing seat billing after
            downgrades (5).
          </p>
        </div>
      </Sidebar.Inset>
    </Sidebar.Provider>
  );
}
// #endregion
