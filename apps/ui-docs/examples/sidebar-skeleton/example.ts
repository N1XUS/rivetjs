import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Sidebar: loading skeleton",
  summary: "Sidebar.MenuSkeleton placeholders (with an icon box) while the menu loads.",
  tags: ["sidebar", "skeleton"],
  status: "experimental",
  frame: { height: 420, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="sidebar-menu-skeleton"] [data-sidebar="menu-skeleton-icon"]' }],
});
