import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Popover: Interactive Content",
  summary: 'Popover demo "Interactive Content".',
  tags: ["popover"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "[data-slot=popover-trigger]" },
    { expect: ["[data-slot=popover-dialog] [data-slot=button]", "Follow"] },
    { click: "[data-slot=popover-dialog] [data-slot=button]" },
    { expect: ["[data-slot=popover-dialog] [data-slot=button]", "Following"] },
  ],
});
