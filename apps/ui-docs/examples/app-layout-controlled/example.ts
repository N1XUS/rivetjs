import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "AppLayout: Controlled",
  summary: "sidebarOpen / asideOpen as two-way signals, driven from outside the layout and by useAppLayout() inside it.",
  tags: ["app-layout", "layout"],
  status: "experimental",
  frame: { height: 516, auto: true, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [
    {
      click: "#app-layout-controlled-sidebar",
    },
    {
      attr: ['[data-app-layout="app-layout-controlled"] > [data-slot="sidebar"]', "data-state", "collapsed"],
    },
    {
      expect: ["#app-layout-controlled-sidebar", "Expand"],
    },
    {
      click: "#app-layout-controlled-hook",
    },
    {
      attr: ["#app-layout-controlled-aside", "data-state", "closed"],
    },
    {
      expect: ["#app-layout-controlled-hook", "Show details"],
    },
  ],
});
