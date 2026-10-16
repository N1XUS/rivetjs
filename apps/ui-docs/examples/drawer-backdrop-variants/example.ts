import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Drawer: Backdrop Variants",
  summary: 'Drawer demo "Backdrop Variants".',
  tags: ["drawer"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "button:nth-of-type(2)" },
    { matches: ".drawer__backdrop--blur" },
    { click: "[data-slot=drawer-close-trigger]" },
    { absent: "[role=dialog]" },
  ],
});
