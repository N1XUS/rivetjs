import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ListBox events",
  summary: 'onSelectionChange and onAction logged: a click selects, a double click or Enter runs the action (selectionBehavior="replace").',
  tags: ["listbox", "events"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#colours-option-green" },
    { expect: ["#log li:nth-child(1)", "selection: green"] },
    { key: "ArrowDown" },
    { expect: ["#log li:nth-child(2)", "selection: blue"] },
    { key: "Enter" },
    { expect: ["#log li:nth-child(3)", "action: blue"] },
  ],
});
