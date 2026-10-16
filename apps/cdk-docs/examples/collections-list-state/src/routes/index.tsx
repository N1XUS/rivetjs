import {
  createListState,
  createSingleSelectListState,
  listCollection,
  listSelectionManager,
  selectedItem,
  setSelectedKey,
} from "@rivetjs/cdk/collections/list-state";
import type { Key, Selection } from "@rivetjs/cdk/collections/types";

export const head = { title: "List state" };

const drinks = [
  { key: "tea", label: "Tea" },
  { key: "coffee", label: "Coffee" },
  { key: "water", label: "Water" },
  { key: "juice", label: "Juice" },
];

const show = (keys: Selection) => (keys === "all" ? "all" : [...keys].map(String).join(", ") || "none");

// #region demo
export default function Drinks() {
  // useListState: items -> collection (derived), selection + focus (signals).
  // disabledKeys: the state's own list (react-stately); item `isDisabled` is read by the selection manager.
  const list = createListState({ items: drinks, selectionMode: "multiple", disabledKeys: ["water"] });
  // useSingleSelectListState: the selection is one key.
  const single = createSingleSelectListState({ items: drinks, defaultSelectedKey: "tea" });
  const manager = () => listSelectionManager(list);
  return (
    <section class="m-4 grid gap-3 text-sm [&_button]:rounded [&_button]:border [&_button]:border-slate-300 [&_button]:px-2">
      <p id="info" class="text-slate-600">
        {listCollection(list).size} items; disabled: {[...list.disabledKeys].join(", ")}; mode: {list.selectionState.selectionMode}
      </p>
      <div class="flex flex-wrap items-center gap-1">
        <button id="toggle-coffee" type="button" onClick={() => manager().toggleSelection("coffee")}>
          toggleSelection("coffee")
        </button>
        <button id="toggle-water" type="button" onClick={() => manager().toggleSelection("water")}>
          toggleSelection("water")
        </button>
        <button id="all" type="button" onClick={() => manager().selectAll()}>
          selectAll()
        </button>
        <output id="multi" class="font-mono">
          {show(list.selectionState.selectedKeys())}
        </output>
      </div>
      <div class="flex flex-wrap items-center gap-1">
        <button id="pick-juice" type="button" onClick={() => setSelectedKey(single, "juice" as Key)}>
          setSelectedKey("juice")
        </button>
        <output id="single" class="font-mono">
          selectedKey {String(single.selectedKey())}, selectedItem {String(selectedItem(single)?.textValue)}
        </output>
      </div>
    </section>
  );
}
// #endregion
