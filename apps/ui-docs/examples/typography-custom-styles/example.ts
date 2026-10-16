import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Typography: Tailwind CSS",
  summary: 'Typography demo "Tailwind CSS".',
  tags: ["typography"],
  status: "experimental",
  frame: { height: 200 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="typography"]' }],
});
