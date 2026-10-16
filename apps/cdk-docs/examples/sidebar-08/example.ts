import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Inset sidebar",
  summary:
    "Port of shadcn/ui block sidebar-08: variant=inset (content in a raised SidebarInset), a SidebarMenuAction toggling each sub menu, projects, and small secondary links pushed to the bottom.",
  tags: ["sidebar", "navigation", "blocks"],
  status: "experimental",
  frame: { height: "xl" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ['[data-slot="sidebar"]', "data-variant", "inset"] },
    { matches: 'li.rv-SidebarMenuItem[data-slot="sidebar-menu-item"][data-expanded="true"]' },
    { matches: '[data-slot="sidebar-menu-button"][data-size="sm"]' },
    { attr: ['[data-slot="sidebar-menu-action"][slot="trigger"]', "aria-expanded", "true"] },
    { click: '[data-slot="sidebar-menu-action"][slot="trigger"]' },
    { attr: ['[data-slot="sidebar-menu-action"][slot="trigger"]', "aria-expanded", "false"] },
    { click: "#s08-trigger" },
    { attr: ['[data-slot="sidebar"]', "data-state", "collapsed"] },
  ],
});
