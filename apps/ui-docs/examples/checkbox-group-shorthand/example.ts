import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CheckboxGroup: Shorthand",
  summary: "Rivet addition: `label`, `description` and `items` props instead of the Label, Description and one Checkbox per option.",
  tags: ["checkbox-group"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { name: ["[role=group]", "Select your interests"] },
    { click: "[data-slot=checkbox-content]" },
    { attr: ["[data-slot=checkbox]", "data-selected", "true"] },
  ],
});
