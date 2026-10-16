import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Surface: Tailwind CSS",
  summary: 'Surface demo "Tailwind CSS".',
  tags: ["surface"],
  status: "experimental",
  frame: { height: 130 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="surface"]' }],
});
