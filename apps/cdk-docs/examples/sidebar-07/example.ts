import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Sidebar that collapses to icons",
  summary:
    "Port of shadcn/ui block sidebar-07: collapsible=icon with a team switcher, Disclosure sub menus, hover-only project actions, a user menu, and menu button tooltips shown only while collapsed.",
  tags: ["sidebar", "navigation", "blocks", "tooltip", "disclosure"],
  status: "experimental",
  frame: { height: "xl" },
  show: ["src/routes/index.tsx"],
  test: [
    // Disclosure items: Playground starts expanded.
    { attr: ['[data-slot="sidebar-menu-button"][slot="trigger"]', "aria-expanded", "true"] },
    { click: '[data-slot="sidebar-menu-button"][slot="trigger"]' },
    { attr: ['[data-slot="sidebar-menu-button"][slot="trigger"]', "aria-expanded", "false"] },
    // Team switcher.
    { click: "#s07-team" },
    { matches: "#s07-teams" },
    { click: '#s07-teams [data-key="1"]' },
    { expect: ["#s07-team-name", "Acme Corp."] },
    { absent: "#s07-teams" },
    // Collapse to icons: tooltips appear on hover.
    { click: "#s07-trigger" },
    { attr: ['[data-slot="sidebar"]', "data-collapsible", "icon"] },
    { hover: '[data-slot="sidebar-menu-button"][slot="trigger"]' },
    { expect: ["[role=tooltip]", "Playground"] },
    { key: "Control+b" },
    { attr: ['[data-slot="sidebar"]', "data-state", "expanded"] },
  ],
});
