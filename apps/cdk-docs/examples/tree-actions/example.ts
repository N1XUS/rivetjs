import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tree: selection and actions",
  summary: "Single selection with onSelectionChange plus onAction; with replace behaviour a click selects and a double click runs the action.",
  tags: ["tree", "selection", "actions"],
  status: "experimental",
  frame: { height: 218, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#evolutions", "aria-multiselectable", null] },
    { click: "#evolutions-charmander" },
    { attr: ["#evolutions-charmander", "aria-selected", "true"] },
    { expect: ["#evolutions-selection", "Selection: charmander"] },
    { click: "#evolutions-squirtle" },
    { attr: ["#evolutions-charmander", "aria-selected", "false"] },
    { expect: ["#evolutions-selection", "Selection: squirtle"] },
    { dblclick: "#evolutions-squirtle" },
    { expect: ["#evolutions-action", "Action: squirtle"] },
    // Disabled rows cannot be selected or focused (disabledBehavior "all").
    { attr: ["#evolutions-venusaur", "aria-disabled", "true"] },
  ],
});
