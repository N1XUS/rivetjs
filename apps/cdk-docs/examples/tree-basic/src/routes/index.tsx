import { ChevronRight, File, Folder } from "lucide";
import { Button } from "@rivetjs/cdk/button";
import { Tree, TreeItem, TreeItemContent } from "@rivetjs/cdk/tree";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Tree" };

// #region demo
/** Row content: a chevron button on parent rows (`slot="chevron"` makes it the expand toggle), an icon and the label. */
function Row(props: { label: string }) {
  return (
    <TreeItemContent>
      {({ hasChildItems, isExpanded }) => (
        <div class="flex items-center gap-1.5" style={{ "padding-inline-start": "calc((var(--tree-item-level) - 1) * 1rem)" }}>
          {hasChildItems() ? (
            <Button slot="chevron" class="grid size-5 place-items-center rounded text-slate-500 hover:bg-slate-200">
              <Icon icon={ChevronRight} size={14} class={isExpanded() ? "rotate-90 transition-transform" : "transition-transform"} />
            </Button>
          ) : (
            <span class="size-5" />
          )}
          <Icon icon={hasChildItems() ? Folder : File} size={16} class="text-slate-500" />
          <span>{props.label}</span>
        </div>
      )}
    </TreeItemContent>
  );
}

export default function Files() {
  return (
    <Tree id="files" aria-label="Files" defaultExpandedKeys={["documents"]} class="m-4 w-72 rounded-lg border border-slate-200 p-1 text-sm outline-none">
      <TreeItem
        id="documents"
        textValue="Documents"
        class="rounded px-1 py-0.5 outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-500 data-[hovered]:bg-slate-100"
      >
        <Row label="Documents" />
        <TreeItem
          id="project"
          textValue="Project"
          class="rounded px-1 py-0.5 outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-500 data-[hovered]:bg-slate-100"
        >
          <Row label="Project" />
          <TreeItem
            id="report"
            textValue="report.pdf"
            class="rounded px-1 py-0.5 outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-500 data-[hovered]:bg-slate-100"
          >
            <Row label="report.pdf" />
          </TreeItem>
        </TreeItem>
        <TreeItem
          id="readme"
          textValue="readme.md"
          class="rounded px-1 py-0.5 outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-500 data-[hovered]:bg-slate-100"
        >
          <Row label="readme.md" />
        </TreeItem>
      </TreeItem>
      <TreeItem
        id="photos"
        textValue="Photos"
        class="rounded px-1 py-0.5 outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-500 data-[hovered]:bg-slate-100"
      >
        <Row label="Photos" />
        <TreeItem
          id="beach"
          textValue="beach.jpg"
          class="rounded px-1 py-0.5 outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-500 data-[hovered]:bg-slate-100"
        >
          <Row label="beach.jpg" />
        </TreeItem>
      </TreeItem>
    </Tree>
  );
}
// #endregion
