import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Sidebar: collapsible to icons",
  summary: 'collapsible="icon" shrinks the panel to an icon rail; menu buttons show their tooltip only while collapsed; the rail toggles too.',
  tags: ["sidebar", "navigation", "tooltip"],
  status: "experimental",
  frame: { height: 420, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#sbi-trigger" },
    { attr: ['[data-slot="sidebar"]', "data-collapsible", "icon"] },
    { hover: "#sbi-inbox" },
    { expect: ["[role=tooltip]", "Inbox"] },
    { click: '[data-sidebar="rail"]' },
    { attr: ['[data-slot="sidebar"]', "data-state", "expanded"] },
  ],
});
