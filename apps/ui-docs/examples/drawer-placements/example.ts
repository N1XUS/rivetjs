import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Drawer: Placement",
  summary: 'Drawer demo "Placement".',
  tags: ["drawer"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "button:nth-of-type(3)" },
    { matches: "[role=dialog][data-placement=left]" },
    { click: "[data-slot=drawer-close-trigger]" },
    { absent: "[role=dialog]" },
  ],
});
