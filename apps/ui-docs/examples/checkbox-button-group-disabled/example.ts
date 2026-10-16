import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CheckboxButtonGroup: Disabled Group",
  summary: "isDisabled on the group disables every card; isDisabled on an Item disables one.",
  tags: ["checkbox-button-group"],
  status: "experimental",
  frame: { height: 440 },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["[data-slot=checkbox-button-group]", "data-disabled", "true"] },
    { matches: "[data-slot=checkbox-button-group-item]:has(input[value=ap])[data-disabled]" },
  ],
});
