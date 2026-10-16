import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ListBox controlled and uncontrolled",
  summary: 'selectedKeys as a signal you write from buttons (a Set or "all"), and defaultSelectedKeys with onSelectionChange and disallowEmptySelection.',
  tags: ["listbox", "selection", "signals"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#controlled-option-m", "aria-selected", "true"] },
    { click: "#controlled-option-s" },
    { expect: ["#controlled-value", "m, s"] },
    // Writing the signal updates the options.
    { click: "#pick-xl" },
    { expect: ["#controlled-value", "xl"] },
    { attr: ["#controlled-option-xl", "aria-selected", "true"] },
    { attr: ["#controlled-option-m", "aria-selected", "false"] },
    { click: "#pick-all" },
    { expect: ["#controlled-value", "all"] },
    { attr: ["#controlled-option-l", "aria-selected", "true"] },
    { click: "#pick-none" },
    { expect: ["#controlled-value", "none"] },
    { attr: ["#controlled-option-xl", "aria-selected", "false"] },
    // Uncontrolled: initial keys from defaultSelectedKeys.
    { attr: ["#uncontrolled-option-m", "aria-selected", "true"] },
    { attr: ["#uncontrolled-option-l", "aria-selected", "true"] },
    { click: "#uncontrolled-option-m" },
    { expect: ["#uncontrolled-value", "onSelectionChange: l"] },
    // disallowEmptySelection: the last selected option cannot be deselected.
    { click: "#uncontrolled-option-l" },
    { attr: ["#uncontrolled-option-l", "aria-selected", "true"] },
    { expect: ["#uncontrolled-value", "onSelectionChange: l"] },
    { click: "#uncontrolled-option-s" },
    { expect: ["#uncontrolled-value", "onSelectionChange: l, s"] },
  ],
});
