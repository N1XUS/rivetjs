import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "AppLayout: Off-canvas",
  summary: 'sidebarCollapsible="offcanvas": the sidebar slides out completely.',
  tags: ["app-layout", "layout"],
  status: "experimental",
  frame: { height: 516, auto: true, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [
    {
      click: "#app-layout-offcanvas-trigger",
    },
    {
      attr: ['[data-app-layout="app-layout-offcanvas"] > [data-slot="sidebar"]', "data-collapsible", "offcanvas"],
    },
  ],
});
