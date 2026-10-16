import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Table: keyboard navigation",
  summary:
    'keyboardNavigationBehavior="tab": arrows move between cells, Tab moves into the focused cell\'s text field; arrows and typing there stay in the field.',
  tags: ["table", "keyboard"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { press: ["#people-ada-name", "ArrowDown"] },
    { focused: "#people-alan-name" },
    { key: "ArrowRight" },
    { focused: "#people tr[data-key=alan] [role=gridcell]" },
    { key: "Tab" },
    { focused: "#people tr[data-key=alan] input" },
    // Typing and arrows stay in the field: no typeahead, no cell navigation.
    { key: "ArrowLeft" },
    { key: "ArrowDown" },
    { key: "s" },
    { focused: "#people tr[data-key=alan] input" },
    // Shift+Tab returns to the cell.
    { key: "Shift+Tab" },
    { focused: "#people tr[data-key=alan] [role=gridcell]" },
  ],
});
