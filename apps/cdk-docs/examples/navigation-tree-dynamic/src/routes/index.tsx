import { signal } from "@rivetjs/reactivity";
import { Link, RouterProvider } from "@rivetjs/cdk/link";
import { NavigationTree, NavigationTreeItem, NavigationTreeItemContent } from "@rivetjs/cdk/navigation-tree";

export const head = { title: "NavigationTree: dynamic items" };

interface Section {
  id: string;
  url: string;
  label: string;
}

const sections: Section[] = [
  { id: "overview", url: "/overview", label: "Overview" },
  { id: "reports", url: "/reports", label: "Reports" },
  { id: "settings", url: "/settings", label: "Settings" },
];

// #region demo
export default function Sections() {
  const route = signal("/reports");
  return (
    <RouterProvider navigate={(href) => route.set(href)}>
      {() => (
        <nav aria-label="Sections" class="m-4 max-w-xs text-sm">
          <NavigationTree id="sections" aria-label="Sections" items={sections} selectedRoute={route} class="grid gap-0.5 outline-none">
            {(section: Section) => (
              <NavigationTreeItem
                id={section.id}
                href={section.url}
                textValue={section.label}
                class="rounded data-[current]:bg-slate-900 data-[current]:text-white"
              >
                <NavigationTreeItemContent>
                  <Link class="block px-2 py-1 outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-500">{section.label}</Link>
                </NavigationTreeItemContent>
              </NavigationTreeItem>
            )}
          </NavigationTree>
        </nav>
      )}
    </RouterProvider>
  );
}
// #endregion
