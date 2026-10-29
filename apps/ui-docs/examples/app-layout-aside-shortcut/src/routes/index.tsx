// Rivet-authored demo (AppLayout is a Rivet addition: feature set scoped from public docs of commercial UI kits; independent implementation on @rivetjs/ui/sidebar).
import { Icon } from "@rivetjs/kit/icon";
import { Folder, House, Inbox, Settings } from "lucide";
import { AppLayout } from "@rivetjs/ui/app-layout";
import { Sidebar } from "@rivetjs/ui/sidebar";

export const head = { title: "AppLayout: Aside shortcut" };

const LINKS = [
  { label: "Overview", icon: House },
  { label: "Inbox", icon: Inbox },
  { label: "Projects", icon: Folder },
  { label: "Settings", icon: Settings },
];

function AppSidebar() {
  return (
    <Sidebar>
      <Sidebar.Header>
        <span class="px-2 text-sm font-semibold in-data-[collapsible=icon]:hidden">Tracker</span>
      </Sidebar.Header>
      <Sidebar.Content>
        <Sidebar.Group>
          <Sidebar.GroupLabel>Workspace</Sidebar.GroupLabel>
          <Sidebar.Menu>
            {LINKS.map((link, i) => (
              <Sidebar.MenuItem>
                <Sidebar.MenuButton href="#" isActive={i === 0} tooltip={link.label}>
                  <Icon icon={link.icon} size={16} />
                  <span>{link.label}</span>
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
            ))}
          </Sidebar.Menu>
        </Sidebar.Group>
      </Sidebar.Content>
    </Sidebar>
  );
}

function Page() {
  return (
    <div class="flex flex-col gap-3 p-6">
      <h1 class="text-xl font-semibold">Overview</h1>
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <div class="rounded-xl bg-surface-secondary p-4 text-sm text-muted">Project update {n}</div>
      ))}
    </div>
  );
}

// #region demo
export function AppLayoutAsideShortcut() {
  return (
    <AppLayout
      id="app-layout-aside-shortcut"
      asideMobile="sheet"
      asideToggleShortcut="mod+shift+e"
      sidebar={() => <AppSidebar />}
      navbar={() => (
        <>
          <AppLayout.MenuToggle />
          <Sidebar.Trigger id="app-layout-aside-shortcut-trigger" />
          <span class="flex-1 text-sm font-medium">Overview</span>
          <AppLayout.AsideTrigger id="app-layout-aside-shortcut-aside-trigger" />
        </>
      )}
      aside={() => (
        <div class="flex flex-col gap-2 p-4 text-sm">
          <h2 class="font-semibold">Details</h2>
          <p class="text-muted">Owner: Design team</p>
          <p class="text-muted">Due: Friday</p>
        </div>
      )}
    >
      <Page />
    </AppLayout>
  );
}
// #endregion

export default function Demo() {
  return <AppLayoutAsideShortcut />;
}
