import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Badge: Placements",
  summary: 'Badge demo "Placements".',
  tags: ["badge"],
  status: "experimental",
  frame: { height: 120 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="badge"]' }],
});
