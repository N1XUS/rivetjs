import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Form: Usage",
  summary: 'Form demo "Usage".',
  tags: ["form"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "button[type=submit]" }, { matches: "[data-slot=field-error]" }],
});
