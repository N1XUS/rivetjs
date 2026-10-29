import { ChevronRight, FileText, Folder, GripVertical } from "lucide";
import { Button } from "@rivetjs/cdk/button";
import { Collection } from "@rivetjs/cdk/collections/components";
import { createTreeData, type TreeNode } from "@rivetjs/cdk/data";
import { useDragAndDrop } from "@rivetjs/cdk/dnd";
import { Tree, TreeItem, TreeItemContent } from "@rivetjs/cdk/tree";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Tree: drag and drop" };

interface FileItem {
  id: string;
  name: string;
  children?: FileItem[];
}

// #region demo
function FileRow(props: { node: TreeNode<FileItem> }) {
  const node = props.node;
  return (
    <TreeItem
      id={node.key}
      textValue={node.value.name}
      class="rounded px-1 py-0.5 outline-none data-[dragging]:opacity-50 data-[drop-target]:bg-sky-100 data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-500"
    >
      <TreeItemContent>
        {({ hasChildItems, isExpanded }) => (
          <div class="flex items-center gap-1.5" style={{ "padding-inline-start": "calc((var(--tree-item-level) - 1) * 1.25rem)" }}>
            <Button slot="drag" class="grid size-5 cursor-grab place-items-center rounded text-slate-400">
              <Icon icon={GripVertical} size={14} />
            </Button>
            {hasChildItems() ? (
              <Button slot="chevron" class="grid size-5 place-items-center rounded text-slate-500">
                <Icon icon={ChevronRight} size={14} class={isExpanded() ? "rotate-90" : ""} />
              </Button>
            ) : (
              <span class="size-5" />
            )}
            <Icon icon={node.value.children ? Folder : FileText} size={14} class="text-slate-500" />
            {node.value.name}
          </div>
        )}
      </TreeItemContent>
      <Collection items={node.children ?? []}>{(child: TreeNode<FileItem>) => <FileRow node={child} />}</Collection>
    </TreeItem>
  );
}

export default function Files() {
  const files = createTreeData<FileItem>({
    initialItems: [
      { id: "documents", name: "Documents", children: [{ id: "report", name: "Report.pdf" }] },
      { id: "photos", name: "Photos", children: [] },
      { id: "notes", name: "Notes.txt" },
    ],
  });
  const { dragAndDropHooks } = useDragAndDrop<TreeNode<FileItem>>({
    getItems: (keys) => [...keys].map((key) => ({ "text/plain": files.getItem(key)?.value.name ?? "" })),
    // Reorder within a level, or drop on a row to move into it.
    onMove(e) {
      if (e.target.dropPosition === "before") files.moveBefore(e.target.key, e.keys);
      else if (e.target.dropPosition === "after") files.moveAfter(e.target.key, e.keys);
      else if (e.target.dropPosition === "on") {
        const index = files.getItem(e.target.key)?.children?.length ?? 0;
        [...e.keys].forEach((key, i) => files.move(key, e.target.key, index + i));
      }
    },
  });
  return (
    <section class="m-4 grid max-w-xs gap-2 text-sm">
      <Tree
        id="files"
        aria-label="Files"
        items={files.items}
        dragAndDropHooks={dragAndDropHooks}
        defaultExpandedKeys={["documents"]}
        class="rounded-lg border border-slate-200 p-1 outline-none"
      >
        {(node: TreeNode<FileItem>) => <FileRow node={node} />}
      </Tree>
    </section>
  );
}
// #endregion
