import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Checkbox: Controlled",
  summary: 'Checkbox demo "Controlled".',
  tags: ["checkbox"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ expect: ["p", "Enabled"] }, { click: "[data-slot=checkbox-content]" }, { expect: ["p", "Disabled"] }],
});
