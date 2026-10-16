import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Badge: Colors",
  summary: 'Badge demo "Colors".',
  tags: ["badge"],
  status: "experimental",
  frame: { height: 96 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="badge"]' }],
});
