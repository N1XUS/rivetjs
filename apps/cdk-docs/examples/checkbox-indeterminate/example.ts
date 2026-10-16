import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Indeterminate Checkbox",
  summary: "A select-all checkbox whose isSelected and isIndeterminate accessors follow two child checkboxes; render props draw a check or a dash.",
  tags: ["checkbox", "indeterminate", "render-props"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "#all:indeterminate" },
    { matches: 'label[data-indeterminate="true"]:has(#all)' },
    { matches: "label:has(#all) svg.dash" },
    { click: "label:has(#all)" },
    { matches: "#all:checked:not(:indeterminate)" },
    { matches: "label:has(#all) svg.check" },
    { matches: "#apples:checked" },
    { matches: "#pears:checked" },
    { click: "label:has(#pears)" },
    { matches: "#all:indeterminate" },
    { click: "label:has(#apples)" },
    { matches: "#all:not(:checked):not(:indeterminate)" },
    { absent: "label:has(#all) svg" },
  ],
});
