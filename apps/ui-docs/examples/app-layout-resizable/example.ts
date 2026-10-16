import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "AppLayout: Resizable",
  summary: "sidebarResizable / asideResizable: drag the panel edges, or focus a handle and use the arrow keys, Home, End and Enter.",
  tags: ["app-layout", "layout"],
  status: "experimental",
  frame: { height: 516, auto: true, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [
    {
      attr: ['[data-slot="app-layout-sidebar-handle"]', "aria-valuenow", "18"],
    },
    {
      press: ['[data-slot="app-layout-sidebar-handle"]', "Home"],
    },
    {
      attr: ['[data-slot="app-layout-sidebar-handle"]', "aria-valuenow", "12"],
    },
    {
      press: ['[data-slot="app-layout-sidebar-handle"]', "Enter"],
    },
    {
      attr: ['[data-slot="app-layout-sidebar-handle"]', "aria-valuenow", "18"],
    },
  ],
});
