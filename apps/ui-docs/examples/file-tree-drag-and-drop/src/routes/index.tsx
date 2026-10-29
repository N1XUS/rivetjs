// Rivet-authored FileTree demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { Collection } from "@rivetjs/cdk/collections/components";
import { createTreeData, type TreeNode } from "@rivetjs/cdk/data";
import { signal } from "@rivetjs/reactivity";
import { FileTree, useFileTreeDrag } from "@rivetjs/ui/file-tree";
import { File, Folder } from "lucide";

export const head = { title: "FileTree: Drag And Drop" };

// #region demo
interface Entry {
  id: string;
  name: string;
  children?: Entry[];
}

function EntryItem(props: { node: TreeNode<Entry> }) {
  const node = props.node;
  return (
    <FileTree.Item id={node.key} title={node.value.name} icon={<Icon icon={node.children ? Folder : File} size={16} />}>
      <Collection items={node.children ?? []}>{(child: TreeNode<Entry>) => <EntryItem node={child} />}</Collection>
    </FileTree.Item>
  );
}

export function DragAndDrop() {
  const tree = createTreeData<Entry>({
    initialItems: [
      {
        id: "src",
        name: "src",
        children: [
          { id: "app", name: "app.tsx" },
          { id: "styles", name: "styles.css" },
        ],
      },
      { id: "assets", name: "assets", children: [] },
      { id: "readme", name: "README.md" },
      { id: "package", name: "package.json" },
    ],
  });
  const last = signal("Drag a row, or focus a row, press Right Arrow and Enter.");
  const { dragAndDropHooks } = useFileTreeDrag({
    tree,
    onMove: (keys, target) => last.set([...keys].join(", ") + " moved " + target.dropPosition + " " + target.key),
  });
  return (
    <div class="grid w-full max-w-xs gap-2">
      <FileTree id="ft-dnd" aria-label="Project files" items={tree.items} dragAndDropHooks={dragAndDropHooks} defaultExpandedKeys={["src"]}>
        {(node: TreeNode<Entry>) => <EntryItem node={node} />}
      </FileTree>
      <p id="ft-dnd-status" class="text-xs text-muted">
        {last()}
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <DragAndDrop />
    </div>
  );
}
