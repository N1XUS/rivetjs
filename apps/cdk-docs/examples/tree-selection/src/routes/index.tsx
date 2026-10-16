import { signal } from "@rivetjs/reactivity";
import { ChevronRight } from "lucide";
import { Button } from "@rivetjs/cdk/button";
import { Checkbox } from "@rivetjs/cdk/checkbox";
import { Tree, TreeItem, TreeItemContent } from "@rivetjs/cdk/tree";
import type { Key, Selection } from "@rivetjs/cdk/collections/types";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Tree: selection and expansion" };

// #region demo
function Row(props: { label: string }) {
  return (
    <TreeItemContent>
      {({ hasChildItems, isExpanded }) => (
        <div class="flex items-center gap-1.5" style={{ "padding-inline-start": "calc((var(--tree-item-level) - 1) * 1.25rem)" }}>
          {/* `slot="selection"`: the row's selection checkbox (checked, labelled and toggled by the tree). */}
          <Checkbox
            slot="selection"
            class="grid size-4 place-items-center rounded border border-slate-400 data-[selected]:border-sky-600 data-[selected]:bg-sky-600"
          />
          {hasChildItems() ? (
            <Button slot="chevron" class="grid size-5 place-items-center rounded text-slate-500 hover:bg-slate-200">
              <Icon icon={ChevronRight} size={14} class={isExpanded() ? "rotate-90" : ""} />
            </Button>
          ) : (
            <span class="size-5" />
          )}
          <span>{props.label}</span>
        </div>
      )}
    </TreeItemContent>
  );
}

const rowClass = "rounded px-1 py-0.5 outline-none data-[selected]:bg-sky-50 data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-500";

export default function Food() {
  const selected = signal<Selection>(new Set<Key>(["apple"]));
  const expanded = signal(new Set<Key>(["fruit"]));
  const list = (keys: Selection | Set<Key>) => (keys === "all" ? "all" : [...keys].join(", ") || "none");
  return (
    <section class="m-4 grid max-w-xs gap-2 text-sm">
      <Tree
        id="food"
        aria-label="Food"
        selectionMode="multiple"
        selectedKeys={selected}
        expandedKeys={expanded}
        class="rounded-lg border border-slate-200 p-1 outline-none"
      >
        <TreeItem id="fruit" textValue="Fruit" class={rowClass}>
          <Row label="Fruit" />
          <TreeItem id="apple" textValue="Apple" class={rowClass}>
            <Row label="Apple" />
          </TreeItem>
          <TreeItem id="pear" textValue="Pear" class={rowClass}>
            <Row label="Pear" />
          </TreeItem>
        </TreeItem>
        <TreeItem id="veg" textValue="Vegetables" class={rowClass}>
          <Row label="Vegetables" />
          <TreeItem id="leek" textValue="Leek" class={rowClass}>
            <Row label="Leek" />
          </TreeItem>
        </TreeItem>
      </Tree>
      <div class="flex gap-2">
        <button id="collapse-all" class="rounded border border-slate-300 px-2 py-0.5" onClick={() => expanded.set(new Set())}>
          Collapse all
        </button>
        <button id="clear" class="rounded border border-slate-300 px-2 py-0.5" onClick={() => selected.set(new Set())}>
          Clear selection
        </button>
      </div>
      <output id="food-selected">Selected: {list(selected())}</output>
      <output id="food-expanded">Expanded: {list(expanded())}</output>
    </section>
  );
}
// #endregion
