import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "List state",
  summary:
    "createListState and createSingleSelectListState (useListState, useSingleSelectListState): the derived collection, the selection manager, setSelectedKey and selectedItem.",
  tags: ["collections", "react-stately"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#info", "4 items; disabled: water; mode: multiple"] },
    { click: "#toggle-coffee" },
    { expect: ["#multi", "coffee"] },
    // Disabled items cannot be selected.
    { click: "#toggle-water" },
    { expect: ["#multi", "coffee"] },
    { click: "#all" },
    { expect: ["#multi", "all"] },
    { expect: ["#single", "selectedKey tea, selectedItem Tea"] },
    { click: "#pick-juice" },
    { expect: ["#single", "selectedKey juice, selectedItem Juice"] },
  ],
});
