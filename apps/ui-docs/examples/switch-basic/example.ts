import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Switch: Usage",
  summary: 'Switch demo "Usage".',
  tags: ["switch"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ click: "[data-slot=switch-content]" }, { matches: "[data-slot=switch]:is([data-selected=true], :has(input:checked))" }],
});
