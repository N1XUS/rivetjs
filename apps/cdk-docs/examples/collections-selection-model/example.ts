import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "SelectionModel",
  summary: "The Angular CDK SelectionModel: toggle, select, deselect, setSelection and clear with each changed event logged; a single model with compareWith.",
  tags: ["collections", "angular-cdk"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#toggle-cheese", "aria-pressed", "true"] },
    { click: "#toggle-basil" },
    { expect: ["#selected", "selected: cheese, basil"] },
    { expect: ["#log li:nth-child(1)", "added [basil] removed []"] },
    { click: "#select-two" },
    { expect: ["#log li:nth-child(2)", "added [olives,chili] removed []"] },
    { click: "#deselect-cheese" },
    { expect: ["#log li:nth-child(3)", "added [] removed [cheese]"] },
    { click: "#set" },
    { expect: ["#selected", "selected: basil"] },
    { expect: ["#log li:nth-child(4)", "added [] removed [olives,chili]"] },
    { click: "#clear" },
    { expect: ["#selected", "selected: none"] },
    { expect: ["#log li:nth-child(5)", "added [] removed [basil]"] },
    // No change, no event.
    { click: "#clear" },
    { absent: "#log li:nth-child(6)" },
    // Single mode with compareWith.
    { click: "#single-1" },
    { expect: ["#single", "single: 1 (isSelected({ id: 1 }): true, multiple: false)"] },
    { click: "#single-2" },
    { expect: ["#single", "single: 2 (isSelected({ id: 1 }): false, multiple: false)"] },
  ],
});
