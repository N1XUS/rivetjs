import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "AppLayout: Collapsible",
  summary: "defaultSidebarOpen={false}: starts collapsed to icons with tooltips; the trigger expands it.",
  tags: ["app-layout", "layout"],
  status: "experimental",
  frame: { height: 516, auto: true, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [
    {
      attr: ['[data-app-layout="app-layout-collapsible"] > [data-slot="sidebar"]', "data-state", "collapsed"],
    },
    {
      click: "#app-layout-collapsible-trigger",
    },
    {
      attr: ['[data-app-layout="app-layout-collapsible"] > [data-slot="sidebar"]', "data-state", "expanded"],
    },
  ],
});
