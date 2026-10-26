import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Checkbox: Usage",
  summary: 'Checkbox demo "Usage".',
  tags: ["checkbox"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ click: "[data-slot=checkbox-content]" }, { matches: "[data-slot=checkbox]:is([data-selected=true], :has(input:checked))" }],
});
