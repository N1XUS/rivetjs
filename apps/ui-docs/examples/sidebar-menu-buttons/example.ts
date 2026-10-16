import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Sidebar: menu button sizes and outline",
  summary: 'Menu buttons in size="sm", "default" and "lg", the outline variant, and isActive for the current page.',
  tags: ["sidebar", "navigation"],
  status: "experimental",
  frame: { height: 420, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: '[data-slot="sidebar-menu-button"][data-size="sm"]' },
    { matches: '[data-slot="sidebar-menu-button"][data-size="lg"]' },
    { matches: '[data-slot="sidebar-menu-button"][data-variant="outline"]' },
    { attr: ["#sbm-active", "data-active", "true"] },
  ],
});
