import { Check, ChevronRight, File, Folder } from "lucide";
import { Button } from "@rivetjs/cdk/button";
import { Checkbox } from "@rivetjs/cdk/checkbox";
import { Tree, TreeItem, TreeItemContent } from "@rivetjs/cdk/tree";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Tree: Tailwind" };

// #region demo
function Row(props: { label: string }) {
  return (
    <TreeItemContent>
      {({ hasChildItems, isExpanded, isSelected }) => (
        <div class="flex items-center gap-2 ps-[calc((var(--tree-item-level)-1)*1.25rem)]">
          <Checkbox
            slot="selection"
            class="grid size-4 shrink-0 place-items-center rounded border border-slate-400 bg-white text-white data-[selected]:border-indigo-600 data-[selected]:bg-indigo-600"
          >
            {() => (isSelected() ? <Icon icon={Check} size={12} strokeWidth={3} /> : null)}
          </Checkbox>
          {hasChildItems() ? (
            <Button slot="chevron" class="grid size-5 place-items-center rounded text-slate-500 hover:bg-slate-200">
              <Icon icon={ChevronRight} size={14} class={isExpanded() ? "rotate-90 transition-transform" : "transition-transform"} />
            </Button>
          ) : (
            <span class="size-5" />
          )}
          <Icon icon={hasChildItems() ? Folder : File} size={16} class="text-indigo-500" />
          <span class="truncate">{props.label}</span>
        </div>
      )}
    </TreeItemContent>
  );
}

const row = [
  "rounded-md px-2 py-1 outline-none cursor-default",
  "data-[hovered]:bg-slate-100 data-[selected]:bg-indigo-50 data-[selected]:text-indigo-900",
  "data-[level=1]:font-medium data-[disabled]:text-slate-400",
  "data-[focus-visible]:ring-2 data-[focus-visible]:ring-indigo-500 data-[focus-visible]:ring-inset",
].join(" ");

export default function TailwindTree() {
  return (
    <Tree
      id="tw-tree"
      aria-label="Project files"
      selectionMode="multiple"
      defaultExpandedKeys={["src"]}
      class="m-4 w-80 rounded-xl border border-slate-200 bg-white p-1.5 text-sm shadow-sm outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-indigo-500"
    >
      <TreeItem id="src" textValue="src" class={row}>
        <Row label="src" />
        <TreeItem id="app" textValue="app.tsx" class={row}>
          <Row label="app.tsx" />
        </TreeItem>
        <TreeItem id="styles" textValue="styles.css" class={row}>
          <Row label="styles.css" />
        </TreeItem>
      </TreeItem>
      <TreeItem id="public" textValue="public" class={row}>
        <Row label="public" />
        <TreeItem id="favicon" textValue="favicon.ico" class={row}>
          <Row label="favicon.ico" />
        </TreeItem>
      </TreeItem>
      <TreeItem id="package" textValue="package.json" class={row}>
        <Row label="package.json" />
      </TreeItem>
    </Tree>
  );
}
// #endregion
