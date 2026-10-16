import { signal } from "@rivetjs/reactivity";
import { ChevronRight } from "lucide";
import { Button } from "@rivetjs/cdk/button";
import { RouterProvider } from "@rivetjs/cdk/link";
import { Tree, TreeItem, TreeItemContent } from "@rivetjs/cdk/tree";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Tree: links" };

// #region demo
function Row(props: { label: string }) {
  return (
    <TreeItemContent>
      {({ hasChildItems, isExpanded }) => (
        <div class="flex items-center gap-1.5" style={{ "padding-inline-start": "calc((var(--tree-item-level) - 1) * 1.25rem)" }}>
          {hasChildItems() ? (
            <Button slot="chevron" class="grid size-5 place-items-center rounded text-slate-500">
              <Icon icon={ChevronRight} size={14} class={isExpanded() ? "rotate-90" : ""} />
            </Button>
          ) : (
            <span class="size-5" />
          )}
          <span class="text-sky-700 underline-offset-2 hover:underline">{props.label}</span>
        </div>
      )}
    </TreeItemContent>
  );
}

const row = "cursor-pointer rounded px-1 py-0.5 outline-none data-[hovered]:bg-slate-100 data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-500";

export default function Pokedex() {
  const last = signal("none");
  return (
    <section class="m-4 grid max-w-xs gap-2 text-sm">
      {/* Without a RouterProvider, a row link navigates the page (a synthetic anchor click). */}
      <RouterProvider navigate={(href) => last.set(`navigate ${href}`)}>
        {() => (
          <Tree id="pokedex" aria-label="Evolutions" defaultExpandedKeys={["bulbasaur"]} class="rounded-lg border border-slate-200 p-1 outline-none">
            <TreeItem id="bulbasaur" textValue="Bulbasaur" href="/pokedex/bulbasaur" class={row}>
              <Row label="Bulbasaur" />
              <TreeItem id="ivysaur" textValue="Ivysaur" href="/pokedex/ivysaur" class={row}>
                <Row label="Ivysaur" />
                <TreeItem id="venusaur" textValue="Venusaur" href="/pokedex/venusaur" class={row}>
                  <Row label="Venusaur" />
                </TreeItem>
              </TreeItem>
            </TreeItem>
          </Tree>
        )}
      </RouterProvider>
      <output id="pokedex-log" class="font-mono text-xs text-slate-600">
        {last()}
      </output>
    </section>
  );
}
// #endregion
