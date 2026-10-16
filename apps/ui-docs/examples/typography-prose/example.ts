import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Typography: Prose",
  summary: 'Typography demo "Prose".',
  tags: ["typography"],
  status: "experimental",
  frame: { height: 280 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=prose]" }],
});
