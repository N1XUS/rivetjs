import { CollectionBuilder, Item } from "@rivetjs/cdk/collections/builder";
import { ListCollection } from "@rivetjs/cdk/collections/list";
import { SelectionManager } from "@rivetjs/cdk/selection/manager";
import { createMultipleSelectionState, type MultipleSelectionState } from "@rivetjs/cdk/selection/state";

export const head = { title: "SelectionManager API" };

const letters = ["a", "b", "c", "d", "e"].map((key) => ({ key, label: key.toUpperCase() }));

// Module-level helper: the collection is rebuilt wherever it is needed (never stored in state).
const collection = () =>
  new ListCollection(new CollectionBuilder<(typeof letters)[number]>().build({ items: letters, children: (item) => Item({ children: item.label }) }));
const managerOf = (state: MultipleSelectionState) => new SelectionManager(collection(), state);

// #region demo
export default function ManagerApi() {
  const state = createMultipleSelectionState({ selectionMode: "multiple", disabledKeys: ["d"] });
  // The manager reads the signals, so a binding that builds one re-renders on change.
  const report = () => {
    const m = managerOf(state);
    const keys = m.isSelectAll ? "all" : [...m.selectedKeys].join(", ") || "none";
    return `${keys} | first: ${m.firstSelectedKey ?? "-"} | last: ${m.lastSelectedKey ?? "-"} | empty: ${m.isEmpty}`;
  };
  return (
    <section class="m-4 grid gap-2 text-sm">
      <div class="flex flex-wrap gap-1 [&>button]:rounded [&>button]:border [&>button]:border-slate-300 [&>button]:px-2">
        <button id="replace-b" type="button" onClick={() => managerOf(state).replaceSelection("b")}>
          replaceSelection("b")
        </button>
        <button id="extend-e" type="button" onClick={() => managerOf(state).extendSelection("e")}>
          extendSelection("e")
        </button>
        <button id="toggle-c" type="button" onClick={() => managerOf(state).toggleSelection("c")}>
          toggleSelection("c")
        </button>
        <button id="select-d" type="button" onClick={() => managerOf(state).select("d")}>
          select("d")
        </button>
        <button id="select-all" type="button" onClick={() => managerOf(state).selectAll()}>
          selectAll()
        </button>
        <button id="toggle-all" type="button" onClick={() => managerOf(state).toggleSelectAll()}>
          toggleSelectAll()
        </button>
        <button id="clear" type="button" onClick={() => managerOf(state).clearSelection()}>
          clearSelection()
        </button>
      </div>
      <output id="report" class="font-mono text-slate-700">
        {report()}
      </output>
      <p id="can-select" class="text-slate-600">
        canSelectItem("d"): {String(managerOf(state).canSelectItem("d"))}, isDisabled("d"): {String(managerOf(state).isDisabled("d"))}
      </p>
    </section>
  );
}
// #endregion
