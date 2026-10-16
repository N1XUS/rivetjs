import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Select sections",
  summary: "Grouped options: sections render as role=group with a header naming them; arrows move across sections.",
  tags: ["select", "sections", "collections"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { press: ["#food-trigger", "ArrowDown"] },
    { matches: "#food-listbox section[role=group]:has(#food-listbox-option-apple)" },
    { name: ["#food-listbox section[role=group]:has(#food-listbox-option-carrot)", "Vegetables"] },
    { expect: ["#food-listbox section:has(#food-listbox-option-carrot) header", "Vegetables"] },
    { focused: "#food-listbox-option-apple" },
    { key: "ArrowDown" },
    { key: "ArrowDown" },
    { focused: "#food-listbox-option-carrot" },
    { key: "Enter" },
    { absent: "#food-listbox" },
    { expect: ["#food-value", "Carrot"] },
    // Closed: ArrowRight crosses into the next item, typeahead searches every section.
    { key: "ArrowRight" },
    { expect: ["#food-value", "Leek"] },
    { key: "b" },
    { expect: ["#food-value", "Banana"] },
  ],
});
