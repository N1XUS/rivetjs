import { signal } from "@rivetjs/reactivity";
import { ChevronRight, Ellipsis } from "lucide";
import { Button } from "@rivetjs/cdk/button";
import { Link, RouterProvider } from "@rivetjs/cdk/link";
import { NavigationTree, NavigationTreeItem, NavigationTreeItemContent } from "@rivetjs/cdk/navigation-tree";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "NavigationTree" };

// #region demo
/** Item content: the row link (href, aria-current come from the item), an optional chevron, a secondary action. */
function Entry(props: { label: string }) {
  return (
    <NavigationTreeItemContent>
      {({ hasChildItems, isExpanded }) => (
        <div class="flex items-center gap-1" style={{ "padding-inline-start": "calc((var(--tree-item-level) - 1) * 1rem)" }}>
          {hasChildItems() ? (
            <Button slot="chevron" class="grid size-5 place-items-center rounded text-slate-500">
              <Icon icon={ChevronRight} size={14} class={isExpanded() ? "rotate-90" : ""} />
            </Button>
          ) : (
            <span class="size-5" />
          )}
          <Link class="flex-1 rounded px-1 outline-none aria-[current=page]:font-semibold data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-500">
            {props.label}
          </Link>
          <Button aria-label="More options" class="grid size-6 place-items-center rounded text-slate-400 hover:bg-slate-200">
            <Icon icon={Ellipsis} size={14} />
          </Button>
        </div>
      )}
    </NavigationTreeItemContent>
  );
}

const item = "rounded px-1 py-0.5 outline-none data-[current]:bg-sky-100 data-[current-ancestor]:text-sky-800";

export default function Sidebar() {
  const route = signal("/photos");
  return (
    <section class="m-4 grid max-w-xs gap-2 text-sm">
      {/* Your router's navigate; here it just records the route. */}
      <RouterProvider navigate={(href) => route.set(href)}>
        {() => (
          <nav aria-label="Main">
            <NavigationTree
              id="sidebar"
              aria-label="Files"
              selectedRoute={route}
              defaultExpandedKeys={["files"]}
              class="rounded-lg border border-slate-200 p-1 outline-none"
            >
              <NavigationTreeItem id="home" href="/home" textValue="Home" class={item}>
                <Entry label="Home" />
              </NavigationTreeItem>
              <NavigationTreeItem id="files" href="/files" textValue="Files" class={item}>
                <Entry label="Files" />
                <NavigationTreeItem id="photos" href="/photos" textValue="Photos" class={item}>
                  <Entry label="Photos" />
                </NavigationTreeItem>
                <NavigationTreeItem id="videos" href="/videos" textValue="Videos" class={item}>
                  <Entry label="Videos" />
                </NavigationTreeItem>
              </NavigationTreeItem>
              {/* A parent without href: its Link expands / collapses the row. */}
              <NavigationTreeItem id="shared" textValue="Shared" class={item}>
                <Entry label="Shared" />
                <NavigationTreeItem id="food" href="/food" textValue="Food" class={item}>
                  <Entry label="Food" />
                </NavigationTreeItem>
                <NavigationTreeItem id="drinks" href="/drinks" textValue="Drinks" class={item}>
                  <Entry label="Drinks" />
                </NavigationTreeItem>
              </NavigationTreeItem>
            </NavigationTree>
          </nav>
        )}
      </RouterProvider>
      <output id="sidebar-route" class="font-mono text-xs text-slate-600">
        Route: {route()}
      </output>
    </section>
  );
}
// #endregion
