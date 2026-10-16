import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CloseButton: Usage",
  summary: 'CloseButton demo "Usage".',
  tags: ["close-button"],
  status: "experimental",
  frame: { height: 96 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="close-button"]' }],
});
