import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TextField: Error Message",
  summary: 'TextField demo "Error Message".',
  tags: ["textfield"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=field-error]" }],
});
