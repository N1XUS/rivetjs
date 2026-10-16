import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TextField: Input Types",
  summary: 'TextField demo "Input Types".',
  tags: ["textfield"],
  status: "experimental",
  frame: { height: 412, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "input[type=email]" }],
});
