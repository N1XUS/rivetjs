import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TextField: In Surface",
  summary: 'TextField demo "In Surface".',
  tags: ["textfield"],
  status: "experimental",
  frame: { height: 408, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=surface] input.input--secondary" }],
});
