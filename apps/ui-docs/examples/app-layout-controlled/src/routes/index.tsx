// Rivet-authored demo (AppLayout is a Rivet addition: feature set inspired by HeroUI Pro's public docs; independent implementation on @rivetjs/ui/sidebar).
import { Icon } from "@rivetjs/kit/icon";
import { Folder, House, Inbox, Settings } from "lucide";
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { AppLayout, useAppLayout } from "@rivetjs/ui/app-layout";
import { Sidebar } from "@rivetjs/ui/sidebar";

export const head = { title: "AppLayout: Controlled" };

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

function AsideStatus() {
  const layout = useAppLayout();
  return (
    <Button id="app-layout-controlled-hook" size="sm" variant="secondary" onPress={() => layout?.toggleAside()}>
      {() => (layout?.isAsideOpen() ? "Hide details" : "Show details")}
    </Button>
  );
}

// #region demo
export function AppLayoutControlled() {
  const sidebarOpen = signal(true);
  const asideOpen = signal(true);
  return (
    <AppLayout
      id="app-layout-controlled"
      sidebarOpen={sidebarOpen}
      asideOpen={asideOpen}
      sidebar={() => <AppSidebar />}
      navbar={() => (
        <>
          <AppLayout.MenuToggle />
          <Button id="app-layout-controlled-sidebar" size="sm" variant="ghost" onPress={() => sidebarOpen.set(!sidebarOpen())}>
            {() => (sidebarOpen() ? "Collapse" : "Expand")}
          </Button>
          <span class="flex-1 text-sm font-medium">Overview</span>
          <AsideStatus />
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
  return <AppLayoutControlled />;
}
