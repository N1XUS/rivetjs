import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Typography: Primitives",
  summary: 'Typography demo "Primitives".',
  tags: ["typography"],
  status: "experimental",
  frame: { height: 248 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="typography"]' }],
});
