// Rivet-authored demo (AppLayout is a Rivet addition: "With Breadcrumbs" section of HeroUI Pro's public docs, own content).
import { Icon } from "@rivetjs/kit/icon";
import { Folder, House, ListTodo, Settings } from "lucide";
import { AppLayout } from "@rivetjs/ui/app-layout";
import { Breadcrumbs } from "@rivetjs/ui/breadcrumbs";
import { Button } from "@rivetjs/ui/button";
import { Sidebar } from "@rivetjs/ui/sidebar";

export const head = { title: "AppLayout: With breadcrumbs" };

const LINKS = [
  { label: "Home", icon: House },
  { label: "Projects", icon: Folder },
  { label: "My tasks", icon: ListTodo },
  { label: "Settings", icon: Settings },
];

function AppSidebar() {
  return (
    <Sidebar>
      <Sidebar.Header>
        <span class="px-2 text-sm font-semibold">Planwise</span>
      </Sidebar.Header>
      <Sidebar.Content>
        <Sidebar.Group>
          <Sidebar.Menu>
            {LINKS.map((link) => (
              <Sidebar.MenuItem>
                <Sidebar.MenuButton href="#" isCurrent={link.label === "Projects"} tooltip={link.label}>
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

// #region demo
export function AppLayoutBreadcrumbs() {
  return (
    <AppLayout
      id="app-layout-breadcrumbs"
      sidebar={() => <AppSidebar />}
      navbar={() => (
        <>
          <AppLayout.MenuToggle />
          <Sidebar.Trigger id="alb-trigger" />
          <Breadcrumbs id="alb-crumbs" class="min-w-0 flex-1">
            <Breadcrumbs.Item href="#">Projects</Breadcrumbs.Item>
            <Breadcrumbs.Item href="#">Website relaunch</Breadcrumbs.Item>
            <Breadcrumbs.Item href="#">Sprint 14</Breadcrumbs.Item>
            <Breadcrumbs.Item>Landing page copy</Breadcrumbs.Item>
          </Breadcrumbs>
          <Button size="sm" variant="secondary">
            Share
          </Button>
        </>
      )}
    >
      <div class="flex flex-col gap-3 p-6">
        <h1 class="text-xl font-semibold">Landing page copy</h1>
        <p class="text-sm text-muted">Sprint 14 · due Friday</p>
        <div class="h-48 rounded-xl bg-surface-secondary" />
      </div>
    </AppLayout>
  );
}
// #endregion

export default function Demo() {
  return <AppLayoutBreadcrumbs />;
}
