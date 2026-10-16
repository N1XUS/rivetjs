import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Form: Tailwind CSS",
  summary: 'Form demo "Tailwind CSS".',
  tags: ["form"],
  status: "experimental",
  frame: { height: 190, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "form [data-slot=textfield]" }],
});
