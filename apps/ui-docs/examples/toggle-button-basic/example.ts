import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ToggleButton: Usage",
  summary: 'ToggleButton demo "Usage".',
  tags: ["toggle-button"],
  status: "experimental",
  frame: { height: 96 },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["[data-slot=toggle-button]", "aria-pressed", "false"] },
    { click: "[data-slot=toggle-button]" },
    { attr: ["[data-slot=toggle-button]", "aria-pressed", "true"] },
  ],
});
