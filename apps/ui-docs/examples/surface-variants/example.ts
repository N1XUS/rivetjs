import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Surface: Variants",
  summary: 'Surface demo "Variants".',
  tags: ["surface"],
  status: "experimental",
  frame: { height: 654 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="surface"]' }],
});
