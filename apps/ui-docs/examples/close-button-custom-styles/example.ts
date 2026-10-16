import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CloseButton: Tailwind CSS",
  summary: 'CloseButton demo "Tailwind CSS".',
  tags: ["close-button"],
  status: "experimental",
  frame: { height: 96 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="close-button"]' }],
});
