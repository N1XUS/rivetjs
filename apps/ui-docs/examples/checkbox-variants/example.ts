import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Checkbox: Variants",
  summary: 'Checkbox demo "Variants".',
  tags: ["checkbox"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".checkbox--secondary" }],
});
