import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NumberField: Shorthand",
  summary: "Rivet addition: `label` and `description` props instead of the Label, Group (stepper buttons, input) and Description parts.",
  tags: ["number-field"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { name: ["input", "Width"] },
    { described: ["input", "In pixels"] },
    { click: "[data-slot=number-field-increment-button]" },
    { attr: ["input", "value", "1,025"] },
  ],
});
