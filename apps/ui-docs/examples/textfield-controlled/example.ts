import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TextField: Controlled",
  summary: 'TextField demo "Controlled".',
  tags: ["textfield"],
  status: "experimental",
  frame: { height: 280 },
  show: ["src/routes/index.tsx"],
  test: [{ fill: ["input", "Ada"] }, { expect: ["[data-slot=description]", "Characters: 3"] }],
});
