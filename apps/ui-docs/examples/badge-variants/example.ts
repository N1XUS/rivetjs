import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Badge: Variants",
  summary: 'Badge demo "Variants".',
  tags: ["badge"],
  status: "experimental",
  frame: { height: 414 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="badge"]' }],
});
