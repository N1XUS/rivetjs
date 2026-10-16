import { computed } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { Item } from "@rivetjs/cdk/collections/builder";
import { createTreeState, setExpandedKeys, toggleTreeKey, treeCollection, treeSelectionManager } from "@rivetjs/cdk/collections/tree-state";
import type { Key } from "@rivetjs/cdk/collections/types";
import { ChevronDown, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Tree state" };

interface Folder {
  id: string;
  name: string;
  children?: Folder[];
}

const files: Folder[] = [
  {
    id: "src",
    name: "src",
    children: [
      { id: "lib", name: "lib", children: [{ id: "list", name: "list.ts" }] },
      { id: "main", name: "main.ts" },
    ],
  },
  { id: "readme", name: "README.md" },
];

// #region demo
export default function Files() {
  const state = createTreeState<Folder>({
    items: files,
    children: (item) => Item({ key: item.id, title: item.name, childItems: item.children, hasChildItems: !!item.children, children: item.name }),
    defaultExpandedKeys: ["src"],
    selectionMode: "single",
  });
  // Only expanded rows are part of the collection (what the keyboard visits).
  const rows = computed(() =>
    [...treeCollection(state).getKeys()].map((key) => {
      const node = treeCollection(state).getItem(key)!;
      return { key, name: node.textValue, level: node.level, branch: node.hasChildNodes, open: state.expandedKeys().has(key) };
    }),
  );
  const select = (key: Key) => treeSelectionManager(state).replaceSelection(key);
  return (
    <section class="m-4 grid max-w-xs gap-2 text-sm">
      <ul id="tree" class="m-0 list-none p-0">
        <For each={rows} by={(row) => row.key}>
          {(row) => (
            <li id={"row-" + String(row().key)} class="flex items-center gap-1" style={{ "padding-left": row().level * 16 + "px" }}>
              <button
                type="button"
                class="w-5 rounded border border-slate-300 disabled:invisible"
                disabled={!row().branch}
                aria-label={"Toggle " + row().name}
                onClick={() => toggleTreeKey(state, row().key)}
              >
                {row().open ? <Icon icon={ChevronDown} size={14} /> : <Icon icon={ChevronRight} size={14} />}
              </button>
              <button
                type="button"
                class="rounded px-1 aria-pressed:bg-teal-700 aria-pressed:text-white"
                aria-pressed={treeSelectionManager(state).isSelected(row().key) ? "true" : "false"}
                onClick={() => select(row().key)}
              >
                {row().name}
              </button>
            </li>
          )}
        </For>
      </ul>
      <div class="flex gap-2">
        <button id="expand-all" type="button" class="rounded border border-slate-300 px-2" onClick={() => setExpandedKeys(state, new Set<Key>(["src", "lib"]))}>
          Expand all
        </button>
        <button id="collapse-all" type="button" class="rounded border border-slate-300 px-2" onClick={() => setExpandedKeys(state, new Set<Key>())}>
          Collapse all
        </button>
      </div>
      <output id="visible" class="font-mono text-slate-600">
        {rows()
          .map((row) => String(row.key))
          .join(" ")}
      </output>
    </section>
  );
}
// #endregion
