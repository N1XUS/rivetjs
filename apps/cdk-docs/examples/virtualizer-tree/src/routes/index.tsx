import { signal } from "@rivetjs/reactivity";
import { Collection } from "@rivetjs/cdk/collections/components";
import type { Selection } from "@rivetjs/cdk/collections/types";
import { Tree, TreeItem, TreeItemContent } from "@rivetjs/cdk/tree";
import { ListLayout, CollectionVirtualizer } from "@rivetjs/cdk/virtualizer";

export const head = { title: "Virtualizer: Tree" };

interface File {
  id: string;
  name: string;
}
interface Folder extends File {
  files: File[];
}

const folders: Folder[] = Array.from({ length: 100 }, (_, f) => ({
  id: `f${f + 1}`,
  name: `Folder ${f + 1}`,
  files: Array.from({ length: 9 }, (_, i) => ({ id: `f${f + 1}-${i + 1}`, name: `File ${f + 1}.${i + 1}` })),
}));

// #region demo
export default function Files() {
  const selected = signal<Selection>(new Set());
  const text = () => {
    const keys = selected();
    return keys === "all" ? "all" : [...keys].join(", ") || "none";
  };
  return (
    <section class="stack">
      <CollectionVirtualizer layout={ListLayout} layoutOptions={{ rowHeight: 32 }} initialSize={{ width: 278, height: 278 }}>
        <Tree
          id="files"
          aria-label="Files"
          items={folders}
          defaultExpandedKeys={folders.map((folder) => folder.id)}
          selectionMode="multiple"
          selectedKeys={selected}
          onSelectionChange={(keys) => selected.set(keys)}
        >
          {(folder: Folder) => (
            <TreeItem id={folder.id} textValue={folder.name}>
              <TreeItemContent>{folder.name}</TreeItemContent>
              <Collection items={folder.files}>
                {(file: File) => (
                  <TreeItem id={file.id} textValue={file.name}>
                    <TreeItemContent>{file.name}</TreeItemContent>
                  </TreeItem>
                )}
              </Collection>
            </TreeItem>
          )}
        </Tree>
      </CollectionVirtualizer>
      <output id="files-value">Selected: {text()}</output>
    </section>
  );
}
// #endregion
