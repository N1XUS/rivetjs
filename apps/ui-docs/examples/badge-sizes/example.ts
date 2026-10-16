import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Badge: Sizes",
  summary: 'Badge demo "Sizes".',
  tags: ["badge"],
  status: "experimental",
  frame: { height: 104 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="badge"]' }],
});
