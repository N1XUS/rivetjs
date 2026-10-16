import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TextField: Validation",
  summary: 'TextField demo "Validation".',
  tags: ["textfield"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [{ fill: ["input", "ab"] }, { expect: ["[data-slot=field-error]", "at least 3"] }, { fill: ["input", "abcd"] }, { absent: "[data-slot=field-error]" }],
});
