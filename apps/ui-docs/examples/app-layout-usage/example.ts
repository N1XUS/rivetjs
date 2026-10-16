import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "AppLayout: Usage",
  summary: "Sidebar + sticky navbar + main content; the trigger (or Cmd/Ctrl+B) collapses the sidebar to icons.",
  tags: ["app-layout", "layout"],
  status: "experimental",
  frame: { height: 516, auto: true, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [
    {
      attr: ['[data-app-layout="app-layout-usage"] > [data-slot="sidebar"]', "data-state", "expanded"],
    },
    {
      click: "#app-layout-usage-trigger",
    },
    {
      attr: ['[data-app-layout="app-layout-usage"] > [data-slot="sidebar"]', "data-state", "collapsed"],
    },
    {
      attr: ['[data-app-layout="app-layout-usage"] > [data-slot="sidebar"]', "data-collapsible", "icon"],
    },
  ],
});
