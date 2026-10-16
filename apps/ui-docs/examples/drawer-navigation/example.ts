import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Drawer: Navigation Drawer",
  summary: 'Drawer demo "Navigation Drawer".',
  tags: ["drawer"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "button" },
    { matches: "[role=dialog][data-placement=left] nav button:nth-of-type(6)" },
    { click: "[data-slot=drawer-close-trigger]" },
    { absent: "[role=dialog]" },
  ],
});
