import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Typography: Scale",
  summary: 'Typography demo "Scale".',
  tags: ["typography"],
  status: "experimental",
  frame: { height: 865 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="typography"]' }],
});
