import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Drawer: Tailwind CSS",
  summary: 'Drawer demo "Tailwind CSS".',
  tags: ["drawer"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "button" }, { matches: "[role=dialog].border-l" }, { click: "[data-slot=drawer-footer] button" }, { absent: "[role=dialog]" }],
});
