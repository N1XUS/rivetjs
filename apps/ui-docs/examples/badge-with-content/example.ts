import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Badge: With Content",
  summary: 'Badge demo "With Content".',
  tags: ["badge"],
  status: "experimental",
  frame: { height: 96 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="badge"]' }],
});
