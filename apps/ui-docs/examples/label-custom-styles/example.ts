import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Label: Tailwind CSS",
  summary: 'Label demo "Tailwind CSS".',
  tags: ["label"],
  status: "experimental",
  frame: { height: 114 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="label"]' }],
});
