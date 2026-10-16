import { Tree, TreeItem } from "@rivetjs/cdk/tree";

export const head = { title: "Tree: empty state" };

const items: { id: string; name: string }[] = [];

// #region demo
export default function Results() {
  return (
    <Tree
      id="results"
      aria-label="Search results"
      items={items}
      renderEmptyState={() => <p class="p-3 text-slate-500 italic">No results found.</p>}
      class="m-4 w-72 rounded-lg border border-dashed border-slate-300 text-sm outline-none data-[empty]:bg-slate-50"
    >
      {(item: { id: string; name: string }) => (
        <TreeItem id={item.id} textValue={item.name}>
          {item.name}
        </TreeItem>
      )}
    </Tree>
  );
}
// #endregion
