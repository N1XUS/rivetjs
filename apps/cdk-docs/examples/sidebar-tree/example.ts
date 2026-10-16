import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Sidebar tree",
  summary:
    "Expandable menu items (SidebarMenuTrigger + SidebarMenuIndicator) with nested sub menus and hover guide lines, a badge, a group of hover actions, isCurrent links and a client router through navigate.",
  tags: ["sidebar", "tree", "navigation"],
  status: "experimental",
  frame: { height: 480, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#st-projects", "aria-expanded", "true"] },
    { click: "#st-projects" },
    { attr: ["#st-projects", "aria-expanded", "false"] },
    { click: "#st-projects" },
    { attr: ["#st-projects", "aria-expanded", "true"] },
    { attr: ["#st-reports", "aria-expanded", "false"] },
    { click: "#st-reports" },
    { attr: ["#st-reports", "aria-expanded", "true"] },
    { click: "#st-q3" },
    { expect: ["#st-path", "/reports/q3"] },
    { attr: ["#st-q3", "aria-current", "page"] },
    { matches: '[data-slot="sidebar-menu"][data-guide-lines="hover"]' },
    { matches: '[data-slot="sidebar-menu-actions"][role="group"]' },
  ],
});
