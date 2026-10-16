import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Surface: Usage",
  summary: 'Surface demo "Usage".',
  tags: ["surface"],
  status: "experimental",
  frame: { height: 160 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="surface"]' }],
});
