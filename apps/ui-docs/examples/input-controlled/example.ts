import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Input: Controlled",
  summary: 'Input demo "Controlled".',
  tags: ["input"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ fill: ["input", "rivet.dev"] }, { expect: ["span", "https://rivet.dev"] }],
});
