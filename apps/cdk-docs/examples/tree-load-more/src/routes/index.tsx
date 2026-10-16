import { ChevronRight, LoaderCircle } from "lucide";
import { Button } from "@rivetjs/cdk/button";
import { Collection } from "@rivetjs/cdk/collections/components";
import { createAsyncList } from "@rivetjs/cdk/data";
import { Tree, TreeItem, TreeItemContent, TreeLoadMoreItem } from "@rivetjs/cdk/tree";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Tree: loading more rows" };

interface Species {
  id: string;
  name: string;
}

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
          {props.label}
        </div>
      )}
    </TreeItemContent>
  );
}

const row = "rounded px-1 py-0.5 outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-500";

export default function SpeciesTree() {
  // A fake paged API (no network): 20 rows per page, 3 pages; the cursor is the next offset.
  const list = createAsyncList<Species, number>({
    load: async ({ cursor }) => {
      await new Promise((resolve) => setTimeout(resolve, 150));
      const start = cursor ?? 0;
      const items = Array.from({ length: 20 }, (_, i) => ({ id: `p${start + i + 1}`, name: `Pokemon ${start + i + 1}` }));
      return { items, cursor: start + 20 < 60 ? start + 20 : undefined };
    },
  });
  return (
    <Tree
      id="species"
      aria-label="Species"
      defaultExpandedKeys={["pokemon"]}
      class="m-4 h-56 w-72 overflow-auto rounded-lg border border-slate-200 p-1 text-sm outline-none"
    >
      <TreeItem id="pokemon" textValue="Pokemon" class={row}>
        <Row label="Pokemon" />
        <Collection items={list.items}>
          {(item: Species) => (
            <TreeItem id={item.id} textValue={item.name} class={row}>
              <Row label={item.name} />
            </TreeItem>
          )}
        </Collection>
        {/* Renders its children only while isLoading; the sentinel is always there. */}
        <TreeLoadMoreItem onLoadMore={() => list.loadMore()} isLoading={() => list.loadingState() === "loadingMore"} class="flex justify-center p-1">
          <Icon icon={LoaderCircle} size={16} class="animate-spin text-slate-400" />
        </TreeLoadMoreItem>
      </TreeItem>
    </Tree>
  );
}
// #endregion
