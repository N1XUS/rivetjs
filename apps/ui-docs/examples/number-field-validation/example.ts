import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NumberField: Validation",
  summary: 'NumberField demo "Validation".',
  tags: ["number-field"],
  status: "experimental",
  frame: { height: 224, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=field-error]" }],
});
