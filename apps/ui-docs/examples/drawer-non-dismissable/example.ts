import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Drawer: Non-Dismissable",
  summary: 'Drawer demo "Non-Dismissable".',
  tags: ["drawer"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "button" }, { matches: "[role=dialog]" }, { click: "[data-slot=drawer-footer] button" }, { absent: "[role=dialog]" }],
});
