import { Button } from "@rivetjs/cdk/button";
import { Collection } from "@rivetjs/cdk/collections/components";
import { createTreeData, type TreeNode } from "@rivetjs/cdk/data";
import { useDragAndDrop } from "@rivetjs/cdk/dnd";
import { Tree, TreeItem, TreeItemContent } from "@rivetjs/cdk/tree";

export const head = { title: "Tree drag and drop" };

// Reorderable Tree (RAC `useDragAndDrop` + `onMove`, docs "Drag and drop"): drag buttons for keyboard / screen
// reader drags, native row drags for the mouse.
interface FileItem {
  id: string;
  name: string;
  children?: FileItem[];
}

function FileRow(props: { node: TreeNode<FileItem> }) {
  const node = props.node;
  return (
    <TreeItem id={node.key} textValue={node.value.name}>
      <TreeItemContent>
        {({ hasChildItems }: { hasChildItems: () => boolean }) => (
          <>
            <Button slot="drag">Drag</Button>
            <Button slot="chevron" style={{ visibility: hasChildItems() ? "visible" : "hidden" }}>
              Toggle
            </Button>
            <span>{node.value.name}</span>
          </>
        )}
      </TreeItemContent>
      <Collection items={node.children ?? []}>{(child: TreeNode<FileItem>) => <FileRow node={child} />}</Collection>
    </TreeItem>
  );
}

export default function TreeDndStory() {
  const files = createTreeData<FileItem>({
    initialItems: [
      { id: "documents", name: "Documents", children: [{ id: "report", name: "Report" }] },
      { id: "photos", name: "Photos" },
      { id: "music", name: "Music" },
    ],
  });
  const { dragAndDropHooks } = useDragAndDrop<TreeNode<FileItem>>({
    getItems: (keys) => [...keys].map((key) => ({ "text/plain": files.getItem(key)?.value.name ?? "" })),
    onMove(e) {
      if (e.target.dropPosition === "before") files.moveBefore(e.target.key, e.keys);
      else if (e.target.dropPosition === "after") files.moveAfter(e.target.key, e.keys);
      else if (e.target.dropPosition === "on") {
        const target = files.getItem(e.target.key);
        const index = target?.children?.length ?? 0;
        [...e.keys].forEach((key, i) => files.move(key, e.target.key, index + i));
      }
    },
  });
  return (
    <section>
      <h1>Tree drag and drop</h1>
      <Tree id="tree-dnd" aria-label="Files" items={files.items} dragAndDropHooks={dragAndDropHooks} defaultExpandedKeys={["documents"]}>
        {(node: TreeNode<FileItem>) => <FileRow node={node} />}
      </Tree>
    </section>
  );
}
