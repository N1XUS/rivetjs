import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ComboBox: multiple selection",
  summary: "`selectionMode=\"multiple\"` keeps the list open while toggling options; `<ComboBoxValue>` lists the selection.",
  tags: ["combobox", "selection"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { expect: ["#picked", "Amsterdam"] },
    { click: 'button[aria-label="Show cities"]' },
    { click: '[role=option][data-key="ber"]' },
    { expect: ["#picked", "Amsterdam and Berlin"] },
    { matches: "[role=listbox]" },
  ],
});
