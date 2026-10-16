import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Input: In Surface",
  summary: 'Input demo "In Surface".',
  tags: ["input"],
  status: "experimental",
  frame: { height: 228, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=surface] input.input--secondary" }],
});
