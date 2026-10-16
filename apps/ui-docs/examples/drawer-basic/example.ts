import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Drawer: Usage",
  summary: 'Drawer demo "Usage".',
  tags: ["drawer"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "button" },
    { matches: "[role=dialog][data-slot=drawer-dialog][data-placement=right]" },
    { expect: ["[data-slot=drawer-heading]", "Drawer Title"] },
    { click: "[data-slot=drawer-footer] button" },
    { absent: "[role=dialog]" },
  ],
});
