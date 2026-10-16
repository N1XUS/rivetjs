import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Input: Input Types",
  summary: 'Input demo "Input Types".',
  tags: ["input"],
  status: "experimental",
  frame: { height: 280 },
  show: ["src/routes/index.tsx"],
  test: [{ name: ["#input-type-email", "Email"] }, { attr: ["#input-type-number", "type", "number"] }],
});
