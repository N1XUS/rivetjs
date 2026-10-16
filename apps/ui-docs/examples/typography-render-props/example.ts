import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Typography: Render Props",
  summary: 'Typography demo "Render Props".',
  tags: ["typography"],
  status: "experimental",
  frame: { height: 168 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "h2[data-slot=typography]" }],
});
