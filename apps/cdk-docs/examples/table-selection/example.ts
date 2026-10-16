import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Table: selection and actions",
  summary: "A selectedKeys signal and onRowAction: a press runs the action until something is selected, Space selects, a disabled row is skipped.",
  tags: ["table", "selection", "actions"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#favorites tbody tr[data-key=venusaur]", "aria-disabled", "true"] },
    // Nothing selected (toggle): a press is the row action.
    { click: "#favorites tbody tr[data-key=blastoise] td:nth-child(2)" },
    { expect: ["#favorites-action", "Last action: blastoise"] },
    { expect: ["#favorites-selected", "Current selection: none"] },
    { key: "ArrowLeft" },
    { key: "Space" },
    { expect: ["#favorites-selected", "Current selection: blastoise"] },
    // With a selection, a press toggles.
    { click: "#favorites tbody tr[data-key=charizard] td:nth-child(3)" },
    { expect: ["#favorites-selected", "Current selection: blastoise, charizard"] },
    // ArrowLeft from the first cell focuses the row itself.
    { key: "ArrowLeft" },
    { key: "ArrowLeft" },
    { key: "ArrowLeft" },
    { focused: "#favorites tbody tr[data-key=charizard]" },
    { key: "ArrowDown" },
    { key: "ArrowDown" },
    // Venusaur is disabled: skipped.
    { focused: "#favorites tbody tr[data-key=pikachu]" },
    { key: "Space" },
    { expect: ["#favorites-selected", "Current selection: blastoise, charizard, pikachu"] },
    { click: "#favorites-all" },
    { attr: ["#favorites tbody tr[data-key=pikachu]", "aria-selected", "true"] },
    { press: ["#favorites tbody tr[data-key=pikachu]", "Escape"] },
    { expect: ["#favorites-selected", "Current selection: none"] },
  ],
});
