import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Surface: With Form Components",
  summary: 'Surface demo "With Form Components".',
  tags: ["surface"],
  status: "experimental",
  frame: { height: 212 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="surface"]' }],
});
