import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Typography: Usage",
  summary: 'Typography demo "Usage".',
  tags: ["typography"],
  status: "experimental",
  frame: { height: 392 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="typography"]' }],
});
