import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Toast: Usage",
  summary: 'Toast demo "Usage".',
  tags: ["toast"],
  status: "experimental",
  frame: { height: 360 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "button" },
    { expect: ["[role=alertdialog]", "You have been invited to join a team"] },
    { click: "[data-slot=toast-action-button]" },
    { absent: "[role=alertdialog]:not([data-exiting])" },
  ],
});
