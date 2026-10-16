import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "FieldError: Usage",
  summary: 'FieldError demo "Usage".',
  tags: ["field-error"],
  status: "experimental",
  frame: { height: 136 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=field-error]" }, { fill: ["input", "jrr"] }, { absent: "[data-slot=field-error]" }],
});
