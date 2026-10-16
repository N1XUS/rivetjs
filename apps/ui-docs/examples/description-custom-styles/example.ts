import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Description: Tailwind CSS",
  summary: 'Description demo "Tailwind CSS".',
  tags: ["description"],
  status: "experimental",
  frame: { height: 159 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="description"]' }],
});
