// Rivet-authored demo (Sidebar is a Rivet addition, own content).
import { signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { Archive, FolderGit2, GitBranch, Plus, Settings, SquarePen } from "lucide";
import { Chip } from "@rivetjs/ui/chip";
import { Sidebar } from "@rivetjs/ui/sidebar";
import { Status } from "@rivetjs/ui/status";

export const head = { title: "Sidebar: agent workspace" };

type TaskState = "running" | "review" | "merged";

interface Task {
  id: string;
  title: string;
  state: TaskState;
  branch: string;
  added: number;
  removed: number;
}

const REPOS: { id: string; name: string; tasks: Task[] }[] = [
  {
    id: "web",
    name: "northwind/web",
    tasks: [
      { id: "upload-test", title: "Fix flaky upload test", state: "running", branch: "fix/upload-retry", added: 42, removed: 18 },
      { id: "dark-charts", title: "Dark mode for charts", state: "review", branch: "feat/chart-themes", added: 311, removed: 74 },
      { id: "vite-upgrade", title: "Upgrade to Vite 8", state: "merged", branch: "chore/vite-8", added: 96, removed: 120 },
    ],
  },
  {
    id: "api",
    name: "northwind/api",
    tasks: [
      { id: "rate-limits", title: "Per-tenant rate limits", state: "running", branch: "feat/tenant-limits", added: 188, removed: 9 },
      { id: "n-plus-one", title: "Remove N+1 in invoices", state: "review", branch: "perf/invoice-query", added: 27, removed: 61 },
    ],
  },
  {
    id: "infra",
    name: "northwind/infra",
    tasks: [{ id: "pg-17", title: "Postgres 17 migration plan", state: "review", branch: "ops/pg17", added: 54, removed: 3 }],
  },
];

const STATE = {
  running: { color: "accent", label: "Running" },
  review: { color: "warning", label: "Needs review" },
  merged: { color: "success", label: "Merged" },
} as const;

const ALL_TASKS = REPOS.flatMap((repo) => repo.tasks.map((task) => ({ ...task, repo: repo.name })));

// #region demo
export default function SidebarAgentWorkspace() {
  const currentId = signal("upload-test");
  const task = () => ALL_TASKS.find((t) => t.id === currentId()) ?? ALL_TASKS[0];
  return (
    <Sidebar.Provider>
      <Sidebar collapsible="offcanvas">
        <Sidebar.Header>
          <Sidebar.Menu>
            <Sidebar.MenuItem>
              <Sidebar.MenuButton id="saw-new" variant="outline">
                <Icon icon={SquarePen} size={16} />
                <span>New task</span>
              </Sidebar.MenuButton>
            </Sidebar.MenuItem>
          </Sidebar.Menu>
        </Sidebar.Header>
        <Sidebar.Content>
          <Sidebar.Group>
            <Sidebar.GroupLabel>Repositories</Sidebar.GroupLabel>
            <Sidebar.GroupAction aria-label="Connect repository">
              <Icon icon={Plus} size={16} />
            </Sidebar.GroupAction>
            <Sidebar.Menu showGuideLines="hover">
              {REPOS.map((repo) => (
                <Sidebar.MenuItem defaultExpanded={repo.id !== "infra"}>
                  <Sidebar.MenuTrigger id={"saw-repo-" + repo.id}>
                    <Icon icon={FolderGit2} size={16} />
                    <span class="truncate">{repo.name}</span>
                    <Sidebar.MenuIndicator />
                  </Sidebar.MenuTrigger>
                  <Sidebar.MenuSub>
                    {repo.tasks.map((t) => (
                      <Sidebar.MenuSubItem>
                        <Sidebar.MenuSubButton id={"saw-" + t.id} href={"#" + t.id} isCurrent={() => currentId() === t.id} onPress={() => currentId.set(t.id)}>
                          <Status size="sm" color={STATE[t.state].color} pulse={t.state === "running"} aria-label={STATE[t.state].label} />
                          <span class="min-w-0 flex-1 truncate">{t.title}</span>
                          <span class="text-xs text-muted tabular-nums">+{t.added}</span>
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
              <Sidebar.MenuButton href="#archived">
                <Icon icon={Archive} size={16} />
                <span>Archived tasks</span>
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
          <Sidebar.Trigger id="saw-trigger" />
          <h1 id="saw-title" class="min-w-0 truncate text-sm font-medium">
            {() => task().title}
          </h1>
        </header>
        <div class="flex flex-col gap-4 p-6 text-sm">
          <div class="flex flex-wrap items-center gap-3 text-muted">
            <span id="saw-repo">{() => task().repo}</span>
            <span class="flex items-center gap-1">
              <Icon icon={GitBranch} size={16} />
              <span id="saw-branch">{() => task().branch}</span>
            </span>
            <span class="tabular-nums">{() => `+${task().added} −${task().removed}`}</span>
          </div>
          <Chip id="saw-state" size="sm" variant="soft" class="self-start">
            <Chip.Label>{() => STATE[task().state].label}</Chip.Label>
          </Chip>
          <p class="max-w-prose leading-6">
            The agent works in its own branch and opens a pull request when the checks pass. Open a task to see its branch and diff size; repositories collapse
            to keep long task lists short.
          </p>
        </div>
      </Sidebar.Inset>
    </Sidebar.Provider>
  );
}
// #endregion
