import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Sidebar: sub menus, actions and badges",
  summary: "A menu item with a badge, an action shown on hover and a nested sub menu of links; a group with its own action.",
  tags: ["sidebar", "navigation"],
  status: "experimental",
  frame: { height: 420, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ['[data-slot="sidebar-menu-badge"]', "12"] },
    { matches: '[data-slot="sidebar-menu-action"][data-show-on-hover="true"]' },
    { attr: ["#sbs-design", "data-active", "true"] },
    { name: ['[data-slot="sidebar-group-action"]', "Add project"] },
  ],
});
