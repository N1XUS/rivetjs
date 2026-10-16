import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ListBox selection modes",
  summary: "selectionMode none, single and multiple: aria-selected, aria-multiselectable, Shift ranges, select all and Escape.",
  tags: ["listbox", "selection"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    // none: no aria-selected at all, focus still moves.
    { attr: ["#none-option-cat", "aria-selected", null] },
    { press: ["#none-option-cat", "ArrowDown"] },
    { focused: "#none-option-dog" },
    { key: "Space" },
    { attr: ["#none-option-dog", "aria-selected", null] },
    // single: clicking another option replaces the selection; clicking the selected one clears it.
    { attr: ["#single", "aria-multiselectable", null] },
    { attr: ["#single-option-dog", "aria-selected", "true"] },
    { click: "#single-option-fox" },
    { expect: ["#single-value", "fox"] },
    { attr: ["#single-option-dog", "aria-selected", "false"] },
    { click: "#single-option-fox" },
    { expect: ["#single-value", "none"] },
    // multiple: clicks toggle, Shift+ArrowDown extends, Mod+A selects all, Escape clears.
    { attr: ["#multiple", "aria-multiselectable", "true"] },
    { click: "#multiple-option-cat" },
    { key: "Shift+ArrowDown" },
    { expect: ["#multiple-value", "cat, dog"] },
    { click: "#multiple-option-owl" },
    { expect: ["#multiple-value", "cat, dog, owl"] },
    { click: "#multiple-option-cat" },
    { expect: ["#multiple-value", "dog, owl"] },
    { key: "ControlOrMeta+a" },
    { expect: ["#multiple-value", "all"] },
    { attr: ["#multiple-option-fox", "aria-selected", "true"] },
    { key: "Escape" },
    { expect: ["#multiple-value", "none"] },
  ],
});
