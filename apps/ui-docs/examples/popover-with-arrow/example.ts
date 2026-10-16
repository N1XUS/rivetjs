import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Popover: With Arrow",
  summary: 'Popover demo "With Arrow".',
  tags: ["popover"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "[aria-label='More options']" },
    { matches: "[data-slot=popover-overlay-arrow]" },
    { key: "Escape" },
    { absent: "[data-slot=popover-dialog]" },
  ],
});
