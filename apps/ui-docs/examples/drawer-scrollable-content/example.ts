import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Drawer: Scrollable Content",
  summary: 'Drawer demo "Scrollable Content".',
  tags: ["drawer"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "button" },
    { matches: "[data-slot=drawer-body] p:nth-of-type(20)" },
    { click: "[data-slot=drawer-close-trigger]" },
    { absent: "[role=dialog]" },
  ],
});
