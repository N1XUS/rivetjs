import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CloseButton: With Custom Icon",
  summary: 'CloseButton demo "With Custom Icon".',
  tags: ["close-button"],
  status: "experimental",
  frame: { height: 104 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="close-button"]' }],
});
