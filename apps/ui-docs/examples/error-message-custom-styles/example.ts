import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ErrorMessage: Tailwind CSS",
  summary: 'ErrorMessage demo "Tailwind CSS".',
  tags: ["error-message"],
  status: "experimental",
  frame: { height: 166 },
  show: ["src/routes/index.tsx"],
  test: [{ expect: ["[data-slot=error-message]", "Choose at least one topic"] }],
});
