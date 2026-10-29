// Rivet-authored demo (AppLayout is a Rivet addition, own content).
import { Icon } from "@rivetjs/kit/icon";
import { Monitor, Moon, Sun } from "lucide";
import { AppLayout } from "@rivetjs/ui/app-layout";
import { SearchField } from "@rivetjs/ui/search-field";
import { Segment } from "@rivetjs/ui/segment";
import { Sidebar } from "@rivetjs/ui/sidebar";

export const head = { title: "AppLayout: Docs site" };

const NAV = [
  { title: "Getting started", pages: ["Introduction", "Installation", "Project structure"] },
  { title: "Guides", pages: ["Routing", "Data loading", "Forms", "Deployment"] },
  { title: "Reference", pages: ["CLI", "Configuration"] },
];

function DocsSidebar() {
  return (
    <Sidebar>
      <Sidebar.Header>
        <span class="px-2 text-sm font-semibold in-data-[collapsible=icon]:hidden">Lattice docs</span>
      </Sidebar.Header>
      <Sidebar.Content>
        {NAV.map((group) => (
          <Sidebar.Group>
            <Sidebar.GroupLabel>{group.title}</Sidebar.GroupLabel>
            <Sidebar.Menu>
              {group.pages.map((page) => (
                <Sidebar.MenuItem>
                  <Sidebar.MenuButton href="#" isCurrent={page === "Routing"}>
                    <span>{page}</span>
                  </Sidebar.MenuButton>
                </Sidebar.MenuItem>
              ))}
            </Sidebar.Menu>
          </Sidebar.Group>
        ))}
      </Sidebar.Content>
    </Sidebar>
  );
}

function ThemeSegment() {
  const themes = [
    { id: "light", label: "Light", icon: Sun },
    { id: "dark", label: "Dark", icon: Moon },
    { id: "system", label: "System", icon: Monitor },
  ];
  return (
    <Segment id="ads-theme" aria-label="Theme" size="sm" defaultSelectedKey="system">
      {themes.map((theme) => (
        <Segment.Item id={theme.id} aria-label={theme.label}>
          <Icon icon={theme.icon} size={16} />
        </Segment.Item>
      ))}
    </Segment>
  );
}

// #region demo
export function AppLayoutDocsSite() {
  return (
    <AppLayout
      id="app-layout-docs-site"
      sidebarCollapsible="offcanvas"
      sidebar={() => <DocsSidebar />}
      navbar={() => (
        <>
          <AppLayout.MenuToggle />
          <Sidebar.Trigger id="ads-trigger" />
          <SearchField name="q" aria-label="Search docs" class="max-w-xs flex-1">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input id="ads-search" placeholder="Search docs..." />
            </SearchField.Group>
          </SearchField>
          <span class="flex-1" />
          <ThemeSegment />
        </>
      )}
    >
      <article class="flex max-w-2xl flex-col gap-3 p-6">
        <p class="text-sm text-muted">Guides</p>
        <h1 class="text-2xl font-semibold">Routing</h1>
        <p class="text-sm">
          Every file in the routes folder becomes a page. Folders nest, layouts wrap their children, and links between pages load only what changed.
        </p>
        <div class="h-48 rounded-xl bg-surface-secondary" />
      </article>
    </AppLayout>
  );
}
// #endregion

export default function Demo() {
  return <AppLayoutDocsSite />;
}
