// UI-BREADCRUMB: the app-layout-complex pattern before its keyed-Show workaround: a Sidebar.MenuButton (sidebar region)
// writes `current`; the navbar region's Breadcrumbs render `{() => page().group}` / `{() => page().label}` (`#lit-al-bc`; function children: text
// only, no link / separator).
import { signal } from "@rivetjs/reactivity";
import { AppLayout } from "@rivetjs/ui/app-layout";
import { Breadcrumbs } from "@rivetjs/ui/breadcrumbs";
import { Sidebar } from "@rivetjs/ui/sidebar";

const LINKS = [
  { id: "home", label: "Home", group: "General" },
  { id: "support", label: "Support triage", group: "Agents" },
];

export default function Shell() {
  const current = signal("home");
  const page = () => LINKS.find((link) => link.id === current()) ?? LINKS[0]!;
  return (
    <AppLayout
      id="lit-al"
      sidebar={() => (
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Menu>
              {LINKS.map((link) => (
                <Sidebar.MenuItem>
                  <Sidebar.MenuButton
                    id={"lit-al-" + link.id}
                    href={"#" + link.id}
                    isCurrent={() => current() === link.id}
                    onPress={() => current.set(link.id)}
                  >
                    <span>{link.label}</span>
                  </Sidebar.MenuButton>
                </Sidebar.MenuItem>
              ))}
            </Sidebar.Menu>
          </Sidebar.Content>
        </Sidebar>
      )}
      navbar={() => (
        <Breadcrumbs id="lit-al-bc">
          <Breadcrumbs.Item href="#">Halcyon</Breadcrumbs.Item>
          <Breadcrumbs.Item href="#">{() => page().group}</Breadcrumbs.Item>
          <Breadcrumbs.Item>{() => page().label}</Breadcrumbs.Item>
        </Breadcrumbs>
      )}
    >
      <p>content</p>
    </AppLayout>
  );
}
