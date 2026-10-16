import { signal, type Signal } from "@rivetjs/reactivity";
import { ChevronRight } from "lucide";
import { Button } from "@rivetjs/cdk/button";
import { Checkbox } from "@rivetjs/cdk/checkbox";
import { Collection } from "@rivetjs/cdk/collections/components";
import type { Selection } from "@rivetjs/cdk/collections/types";
import { createTreeData, type TreeNode } from "@rivetjs/cdk/data";
import { Tree, TreeItem, TreeItemContent } from "@rivetjs/cdk/tree";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "createTreeData" };

interface Person {
  id: string;
  name: string;
  children?: Person[];
}

// #region demo
/** One row per tree node; children through a nested Collection over node.children. */
function PersonItem(props: { node: TreeNode<Person> }) {
  const node = props.node;
  return (
    <TreeItem
      id={node.key}
      textValue={node.value.name}
      class="rounded px-1 py-0.5 outline-none data-[selected]:bg-sky-50 data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-500"
    >
      <TreeItemContent>
        {({ hasChildItems, isExpanded }) => (
          <div class="flex items-center gap-1.5" style={{ "padding-inline-start": "calc((var(--tree-item-level) - 1) * 1.25rem)" }}>
            <Checkbox slot="selection" class="size-4 rounded border border-slate-400 data-[selected]:border-sky-600 data-[selected]:bg-sky-600" />
            {hasChildItems() ? (
              <Button slot="chevron" class="grid size-5 place-items-center rounded text-slate-500">
                <Icon icon={ChevronRight} size={14} class={isExpanded() ? "rotate-90" : ""} />
              </Button>
            ) : (
              <span class="size-5" />
            )}
            {node.value.name}
          </div>
        )}
      </TreeItemContent>
      <Collection items={node.children ?? []}>{(child: TreeNode<Person>) => <PersonItem node={child} />}</Collection>
    </TreeItem>
  );
}

export default function People() {
  const tree = createTreeData<Person>({
    initialItems: [
      { id: "david", name: "David", children: [{ id: "john", name: "John", children: [{ id: "sam", name: "Sam" }] }] },
      { id: "emma", name: "Emma" },
    ],
    initialSelectedKeys: ["john"],
    // getKey defaults to item.id ?? item.key, getChildren to item.children.
  });
  const next = signal(1);
  const expanded = signal(new Set<string | number>(["david", "john"]));
  const first = () => [...tree.selectedKeys()][0];
  const button = "rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-100";
  return (
    <section class="m-4 grid max-w-sm gap-2 text-sm">
      <Tree
        id="people"
        aria-label="People"
        selectionMode="multiple"
        items={tree.items}
        // createTreeData types its selection as a Set (react-stately useTreeData); the Tree writes a Selection,
        // which can be "all" (Ctrl+A in "multiple" mode).
        selectedKeys={tree.selectedKeys as Signal<Selection>}
        expandedKeys={expanded}
        class="rounded-lg border border-slate-200 p-1 outline-none"
      >
        {(node: TreeNode<Person>) => <PersonItem node={node} />}
      </Tree>
      <div class="flex flex-wrap gap-2">
        <button
          id="people-add"
          class={button}
          onClick={() => {
            const n = next();
            const parent = first() ?? null;
            tree.append(parent, { id: `person-${n}`, name: `Person ${n}` });
            if (parent != null) expanded.set(new Set([...expanded(), parent]));
            next.set(n + 1);
          }}
        >
          Add child
        </button>
        <button id="people-root" class={button} onClick={() => first() != null && tree.move(first()!, null, 0)}>
          Move to root
        </button>
        <button
          id="people-rename"
          class={button}
          onClick={() => {
            const node = tree.getItem("sam");
            if (node) tree.update("sam", { ...node.value, name: `${node.value.name} (renamed)` });
          }}
        >
          Rename Sam
        </button>
        <button id="people-remove" class={button} onClick={() => tree.removeSelectedItems()}>
          Remove selected
        </button>
      </div>
      <output id="people-selection">Selected: {[...tree.selectedKeys()].join(", ") || "none"}</output>
    </section>
  );
}
// #endregion
