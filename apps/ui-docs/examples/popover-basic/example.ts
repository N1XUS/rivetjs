import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Popover: Usage",
  summary: 'Popover demo "Usage".',
  tags: ["popover"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "[data-slot=button]" },
    { expect: ["[data-slot=popover-dialog]", "Popover Title"] },
    { key: "Escape" },
    { absent: "[data-slot=popover-dialog]" },
  ],
});
