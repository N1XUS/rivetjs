import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TextField: Full Width",
  summary: 'TextField demo "Full Width".',
  tags: ["textfield"],
  status: "experimental",
  frame: { height: 204, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=textfield].textfield--full-width" }],
});
