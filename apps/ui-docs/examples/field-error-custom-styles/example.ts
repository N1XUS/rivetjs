import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "FieldError: Tailwind CSS",
  summary: 'FieldError demo "Tailwind CSS".',
  tags: ["field-error"],
  status: "experimental",
  frame: { height: 136 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=field-error]" }],
});
