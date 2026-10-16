import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Sidebar with submenus",
  summary:
    "Port of shadcn/ui block sidebar-03: a large header menu button, top-level links each followed by a SidebarMenuSub of sub buttons (one isActive), collapsed off canvas by the trigger.",
  tags: ["sidebar", "navigation", "blocks"],
  status: "experimental",
  frame: { height: "xl" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ['[data-slot="sidebar-menu-sub-button"][data-active="true"]', "Data Fetching"] },
    { attr: ['[data-slot="sidebar-menu-sub-button"][data-active="true"]', "data-size", "md"] },
    { matches: '[data-slot="sidebar-menu-sub"] > [data-slot="sidebar-menu-sub-item"]' },
    { press: ["#s03-trigger", "Enter"] },
    { attr: ['[data-slot="sidebar"]', "data-state", "collapsed"] },
    { press: ["#s03-trigger", "Space"] },
    { attr: ['[data-slot="sidebar"]', "data-state", "expanded"] },
  ],
});
