import { signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { Archive, Calendar, Folder, FolderKanban, House, Inbox, Pencil, Plus, Settings, Trash2 } from "lucide";
import { Avatar } from "@rivetjs/ui/avatar";
import { Sidebar } from "@rivetjs/ui/sidebar";

export const head = { title: "Sidebar: complex app shell" };

const projects = [
  { id: "launch", title: "Launch", pages: ["Roadmap", "Budget", "Press kit"] },
  { id: "research", title: "Research", pages: ["Interviews", "Survey"] },
];

// #region demo
export default function SidebarAppShell() {
  const current = signal("Overview");
  return (
    <Sidebar.Provider>
      <Sidebar collapsible="icon">
        <Sidebar.Header>
          <Sidebar.Menu>
            <Sidebar.MenuItem>
              <Sidebar.MenuButton size="lg" tooltip="Northwind Studio">
                <Avatar size="sm" color="accent">
                  <Avatar.Fallback>NS</Avatar.Fallback>
                </Avatar>
                <span class="flex flex-col leading-tight">
                  <span class="font-medium">Northwind Studio</span>
                  <span class="text-xs text-muted">Team plan</span>
                </span>
              </Sidebar.MenuButton>
            </Sidebar.MenuItem>
          </Sidebar.Menu>
        </Sidebar.Header>
        <Sidebar.Content>
          <Sidebar.Group>
            <Sidebar.GroupLabel>Workspace</Sidebar.GroupLabel>
            <Sidebar.Menu>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton href="#overview" tooltip="Overview" isCurrent={() => current() === "Overview"} onPress={() => current.set("Overview")}>
                  <Icon icon={House} size={16} />
                  <span>Overview</span>
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton href="#inbox" tooltip="Inbox" isCurrent={() => current() === "Inbox"} onPress={() => current.set("Inbox")}>
                  <Icon icon={Inbox} size={16} />
                  <span>Inbox</span>
                </Sidebar.MenuButton>
                <Sidebar.MenuChip id="sas-inbox-chip">12</Sidebar.MenuChip>
              </Sidebar.MenuItem>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton href="#calendar" tooltip="Calendar" isCurrent={() => current() === "Calendar"} onPress={() => current.set("Calendar")}>
                  <Icon icon={Calendar} size={16} />
                  <span>Calendar</span>
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
            </Sidebar.Menu>
          </Sidebar.Group>
          <Sidebar.Group>
            <Sidebar.GroupLabel>Projects</Sidebar.GroupLabel>
            <Sidebar.GroupAction aria-label="New project">
              <Icon icon={Plus} size={16} />
            </Sidebar.GroupAction>
            <Sidebar.Menu>
              <Sidebar.MenuItem defaultExpanded>
                <Sidebar.MenuTrigger id="sas-projects-trigger" tooltip="Projects">
                  <Icon icon={FolderKanban} size={16} />
                  <span>Active projects</span>
                  <Sidebar.MenuIndicator />
                </Sidebar.MenuTrigger>
                <Sidebar.MenuSub>
                  {projects.map((project) => (
                    <Sidebar.MenuSubItem defaultExpanded={project.id === "launch"}>
                      <Sidebar.MenuTrigger>
                        <Icon icon={Folder} size={16} />
                        <span>{project.title}</span>
                        <Sidebar.MenuIndicator />
                      </Sidebar.MenuTrigger>
                      <Sidebar.MenuSub>
                        {project.pages.map((page) => (
                          <Sidebar.MenuSubItem>
                            <Sidebar.MenuSubButton
                              id={"sas-" + page.toLowerCase().replace(" ", "-")}
                              href={"#" + page.toLowerCase().replace(" ", "-")}
                              isCurrent={() => current() === page}
                              onPress={() => current.set(page)}
                            >
                              <span>{page}</span>
                            </Sidebar.MenuSubButton>
                          </Sidebar.MenuSubItem>
                        ))}
                      </Sidebar.MenuSub>
                    </Sidebar.MenuSubItem>
                  ))}
                </Sidebar.MenuSub>
              </Sidebar.MenuItem>
              <Sidebar.MenuItem>
                <Sidebar.MenuButton href="#archive" tooltip="Archive" isCurrent={() => current() === "Archive"} onPress={() => current.set("Archive")}>
                  <Icon icon={Archive} size={16} />
                  <span>Archive</span>
                </Sidebar.MenuButton>
                <Sidebar.MenuActions showOnHover aria-label="Archive actions">
                  <Sidebar.MenuAction aria-label="Rename archive">
                    <Icon icon={Pencil} size={14} />
                  </Sidebar.MenuAction>
                  <Sidebar.MenuAction aria-label="Empty archive">
                    <Icon icon={Trash2} size={14} />
                  </Sidebar.MenuAction>
                </Sidebar.MenuActions>
              </Sidebar.MenuItem>
            </Sidebar.Menu>
          </Sidebar.Group>
        </Sidebar.Content>
        <Sidebar.Footer>
          <Sidebar.Menu>
            <Sidebar.MenuItem>
              <Sidebar.MenuButton href="#settings" tooltip="Settings" isCurrent={() => current() === "Settings"} onPress={() => current.set("Settings")}>
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
          <Sidebar.Trigger id="sas-trigger" />
          <h1 id="sas-title" class="text-sm font-medium">
            {current()}
          </h1>
        </header>
        <div class="p-4 text-sm text-muted">Expand a project, open a page, hover Archive for its actions.</div>
      </Sidebar.Inset>
    </Sidebar.Provider>
  );
}
// #endregion
