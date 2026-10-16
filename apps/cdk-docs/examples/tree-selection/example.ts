import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tree: selection and expansion",
  summary: "Multiple selection with selection checkboxes; selectedKeys and expandedKeys are two-way signals you can also write.",
  tags: ["tree", "selection", "controlled"],
  status: "experimental",
  frame: { height: 228, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#food", "aria-multiselectable", "true"] },
    { attr: ["#food-fruit", "aria-expanded", "true"] },
    { attr: ["#food-apple", "aria-selected", "true"] },
    { expect: ["#food-selected", "Selected: apple"] },
    { click: "#food-pear [slot=selection]" },
    { attr: ["#food-pear", "aria-selected", "true"] },
    { expect: ["#food-selected", "Selected: apple, pear"] },
    { click: "#food-veg-chevron" },
    { expect: ["#food-expanded", "Expanded: fruit, veg"] },
    { expect: ["#food-leek", "Leek"] },
    // Write the signals yourself.
    { click: "#collapse-all" },
    { absent: "#food-apple" },
    { expect: ["#food-expanded", "Expanded: none"] },
    { click: "#clear" },
    { expect: ["#food-selected", "Selected: none"] },
    { attr: ["#food-fruit", "aria-selected", "false"] },
    // Keyboard: Space toggles the focused row.
    { press: ["#food-fruit", "Space"] },
    { expect: ["#food-selected", "Selected: fruit"] },
  ],
});
