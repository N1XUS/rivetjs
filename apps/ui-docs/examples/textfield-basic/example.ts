import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TextField: Usage",
  summary: 'TextField demo "Usage".',
  tags: ["textfield"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ name: ["input", "Email"] }, { fill: ["input", "ada@example.com"] }],
});
