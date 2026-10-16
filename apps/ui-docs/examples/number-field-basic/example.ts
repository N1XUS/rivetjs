import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NumberField: Usage",
  summary: 'NumberField demo "Usage".',
  tags: ["number-field"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ name: ["input", "Width"] }, { click: "[data-slot=number-field-increment-button]" }, { attr: ["input", "value", "1,025"] }],
});
