import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Slider: Disabled",
  summary: 'Slider demo "Disabled".',
  tags: ["slider"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["[data-slot=slider]", "data-disabled", "true"] }, { attr: ["input[type=range]", "disabled", ""] }],
});
