import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Input: Usage",
  summary: 'Input demo "Usage".',
  tags: ["input"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ name: ["input", "Name"] }, { fill: ["input", "Ada"] }, { matches: "input.input.input--primary" }],
});
