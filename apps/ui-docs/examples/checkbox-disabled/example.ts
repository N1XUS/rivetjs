import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Checkbox: Disabled",
  summary: 'Checkbox demo "Disabled".',
  tags: ["checkbox"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["input[type=checkbox]", "disabled", ""] }],
});
