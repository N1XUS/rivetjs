// Rivet-authored demo (Sidebar is a Rivet addition, own content).
import { signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { ChevronsUpDown, FileText, Hash, Plus, Search, Settings, Trash2, Users } from "lucide";
import { Avatar } from "@rivetjs/ui/avatar";
import { Command } from "@rivetjs/ui/command";
import { Dropdown } from "@rivetjs/ui/dropdown";
import { Label } from "@rivetjs/ui/label";
import { Sidebar } from "@rivetjs/ui/sidebar";

export const head = { title: "Sidebar: meeting notes" };

const WORKSPACES = [
  { id: "northwind", name: "Northwind", initials: "NW" },
  { id: "personal", name: "Personal", initials: "PE" },
];

const SPACES = [
  { id: "product", title: "Product", notes: ["Q3 roadmap review", "Pricing page workshop"] },
  { id: "engineering", title: "Engineering", notes: ["Sprint 14 retro", "Incident 2207 debrief", "API versioning sync"] },
  { id: "customers", title: "Customer calls", notes: ["Halcyon onboarding", "Kestrel renewal"] },
];

const slug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

// #region demo
export default function SidebarMeetingNotes() {
  const workspace = signal("Northwind");
  const note = signal("Sprint 14 retro");
  const searchOpen = signal(false);
  return (
    <Sidebar.Provider>
      <Sidebar collapsible="offcanvas">
        <Sidebar.Header>
          <Sidebar.Menu>
            <Sidebar.MenuItem>
              <Dropdown>
                <Sidebar.MenuButton id="smn-workspace" size="lg" aria-label="Switch workspace">
                  <Avatar size="sm" color="accent">
                    <Avatar.Fallback>{() => (workspace() === "Personal" ? "PE" : "NW")}</Avatar.Fallback>
                  </Avatar>
                  <span class="flex flex-col leading-tight">
                    <span id="smn-workspace-name" class="font-medium">
                      {workspace}
                    </span>
                    <span class="text-xs text-muted">Meeting notes</span>
                  </span>
                  <Icon icon={ChevronsUpDown} size={16} class="ms-auto" />
                </Sidebar.MenuButton>
                <Dropdown.Popover placement="bottom start">
                  <Dropdown.Menu aria-label="Workspaces" onAction={(key) => workspace.set(WORKSPACES.find((w) => w.id === key)?.name ?? "Northwind")}>
                    {WORKSPACES.map((w) => (
                      <Dropdown.Item id={w.id} textValue={w.name}>
                        <Avatar size="sm">
                          <Avatar.Fallback>{w.initials}</Avatar.Fallback>
                        </Avatar>
                        <Label>{w.name}</Label>
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
            </Sidebar.MenuItem>
            <Sidebar.MenuItem>
              <Command isOpen={searchOpen}>
                <Sidebar.MenuButton id="smn-search">
                  <Icon icon={Search} size={16} />
                  <span>Search notes</span>
                </Sidebar.MenuButton>
                <Command.Backdrop>
                  <Command.Container>
                    <Command.Dialog>
                      <Command.InputGroup>
                        <Command.InputGroup.Prefix>
                          <Icon icon={Search} size={16} />
                        </Command.InputGroup.Prefix>
                        <Command.InputGroup.Input placeholder="Search notes…" />
                        <Command.InputGroup.ClearButton />
                      </Command.InputGroup>
                      <Command.List
                        onAction={(key) => {
                          const found = SPACES.flatMap((space) => space.notes).find((title) => slug(title) === key);
                          if (found) note.set(found);
                          searchOpen.set(false);
                        }}
                      >
                        {SPACES.map((space) => (
                          <Command.Group heading={space.title}>
                            {space.notes.map((title) => (
                              <Command.Item id={slug(title)} icon={FileText}>
                                {title}
                              </Command.Item>
                            ))}
                          </Command.Group>
                        ))}
                      </Command.List>
                    </Command.Dialog>
                  </Command.Container>
                </Command.Backdrop>
              </Command>
            </Sidebar.MenuItem>
          </Sidebar.Menu>
        </Sidebar.Header>
        <Sidebar.Content>
          <Sidebar.Group>
            <Sidebar.GroupLabel>Spaces</Sidebar.GroupLabel>
            <Sidebar.GroupAction aria-label="New space">
              <Icon icon={Plus} size={16} />
            </Sidebar.GroupAction>
            <Sidebar.Menu>
              {SPACES.map((space) => (
                <Sidebar.MenuItem defaultExpanded={space.id === "engineering"}>
                  <Sidebar.MenuTrigger id={"smn-space-" + space.id}>
                    <Icon icon={Hash} size={16} />
                    <span>{space.title}</span>
                    <Sidebar.MenuIndicator />
                  </Sidebar.MenuTrigger>
                  <Sidebar.MenuSub>
                    {space.notes.map((title) => (
                      <Sidebar.MenuSubItem>
                        <Sidebar.MenuSubButton
                          id={"smn-" + slug(title)}
                          href={"#" + slug(title)}
                          isCurrent={() => note() === title}
                          onPress={() => note.set(title)}
                        >
                          <span>{title}</span>
                        </Sidebar.MenuSubButton>
                      </Sidebar.MenuSubItem>
                    ))}
                  </Sidebar.MenuSub>
                </Sidebar.MenuItem>
              ))}
            </Sidebar.Menu>
          </Sidebar.Group>
        </Sidebar.Content>
        <Sidebar.Footer>
          <Sidebar.Menu>
            <Sidebar.MenuItem>
              <Sidebar.MenuButton href="#members">
                <Icon icon={Users} size={16} />
                <span>Members</span>
              </Sidebar.MenuButton>
            </Sidebar.MenuItem>
            <Sidebar.MenuItem>
              <Sidebar.MenuButton href="#trash">
                <Icon icon={Trash2} size={16} />
                <span>Trash</span>
              </Sidebar.MenuButton>
            </Sidebar.MenuItem>
            <Sidebar.MenuItem>
              <Sidebar.MenuButton href="#settings">
                <Icon icon={Settings} size={16} />
                <span>Settings</span>
              </Sidebar.MenuButton>
            </Sidebar.MenuItem>
          </Sidebar.Menu>
        </Sidebar.Footer>
        <Sidebar.Rail />
      </Sidebar>
      <Sidebar.Inset>
        <header class="flex h-12 items-center gap-2 border-b border-separator px-4">
          <Sidebar.Trigger id="smn-trigger" />
          <h1 id="smn-title" class="min-w-0 truncate text-sm font-medium">
            {note}
          </h1>
        </header>
        <article class="flex max-w-prose flex-col gap-4 p-6 text-sm leading-6">
          <p class="text-muted">Thursday, 10:00 · 45 min · Priya Nair, Tomás Ortega, Lena Fischer</p>
          <section class="flex flex-col gap-2">
            <h2 class="font-semibold">Decisions</h2>
            <ul class="list-disc ps-5">
              <li>Move the release freeze to Wednesday so QA gets two full days.</li>
              <li>Flaky upload tests leave the merge queue until they are fixed.</li>
            </ul>
          </section>
          <section class="flex flex-col gap-2">
            <h2 class="font-semibold">Action items</h2>
            <ul class="list-disc ps-5">
              <li>Tomás: write the rollback checklist for the billing migration.</li>
              <li>Lena: share the on-call rotation for November by Monday.</li>
            </ul>
          </section>
        </article>
      </Sidebar.Inset>
    </Sidebar.Provider>
  );
}
// #endregion
