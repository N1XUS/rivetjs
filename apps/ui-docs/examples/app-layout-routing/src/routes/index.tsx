// Rivet-authored demo (AppLayout is a Rivet addition: "Client-Side Routing" section of HeroUI Pro's public docs, own content).
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { CreditCard, House, Users } from "lucide";
import { AppLayout } from "@rivetjs/ui/app-layout";
import { Sidebar } from "@rivetjs/ui/sidebar";

export const head = { title: "AppLayout: Client-side routing" };

const PAGES = [
  { href: "/", label: "Overview", icon: House },
  { href: "/team", label: "Team", icon: Users },
  { href: "/billing", label: "Billing", icon: CreditCard },
];

// #region demo
export function AppLayoutRouting() {
  // Stand-in for a router's location. With @rivetjs/router, omit `navigate`: links route through the router already.
  const path = signal("/");
  const current = () => PAGES.find((page) => page.href === path()) ?? PAGES[0]!;
  return (
    <AppLayout
      id="app-layout-routing"
      navigate={(href) => path.set(href)}
      sidebar={() => (
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Group>
              <Sidebar.Menu>
                {PAGES.map((page) => (
                  <Sidebar.MenuItem>
                    <Sidebar.MenuButton id={`alr-${page.label.toLowerCase()}`} href={page.href} isCurrent={() => path() === page.href} tooltip={page.label}>
                      <Icon icon={page.icon} size={16} />
                      <span>{page.label}</span>
                    </Sidebar.MenuButton>
                  </Sidebar.MenuItem>
                ))}
              </Sidebar.Menu>
            </Sidebar.Group>
          </Sidebar.Content>
        </Sidebar>
      )}
      navbar={() => (
        <>
          <AppLayout.MenuToggle />
          <Sidebar.Trigger id="alr-trigger" />
          <span class="flex-1 text-sm font-medium">
            <code id="alr-path">{path()}</code>
          </span>
        </>
      )}
    >
      <div class="flex flex-col gap-3 p-6">
        <h1 id="alr-title" class="text-xl font-semibold">
          {current().label}
        </h1>
        <div class="h-40 rounded-xl bg-surface-secondary" />
      </div>
    </AppLayout>
  );
}
// #endregion

export default function Demo() {
  return <AppLayoutRouting />;
}
