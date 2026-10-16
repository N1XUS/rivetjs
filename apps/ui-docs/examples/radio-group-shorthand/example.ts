import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RadioGroup: Shorthand",
  summary: "Rivet addition: `label`, `description` and `items` props instead of the Label, Description and one Radio per option.",
  tags: ["radio-group"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { name: ["[role=radiogroup]", "Plan selection"] },
    { attr: ["[data-slot=radio]:nth-of-type(2)", "data-selected", "true"] },
    { click: "[data-slot=radio]:nth-of-type(3) [data-slot=radio-content]" },
    { attr: ["[data-slot=radio]:nth-of-type(3)", "data-selected", "true"] },
  ],
});
