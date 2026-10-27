import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "AppLayout: With breadcrumbs",
  summary: "A project-management navbar: a multi-level breadcrumb trail for the current depth next to a page action.",
  tags: ["app-layout", "layout", "breadcrumbs"],
  status: "experimental",
  frame: { height: 420, auto: true, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [{ expect: ["#alb-crumbs", "Website relaunch"] }, { attr: ["#alb-crumbs [aria-current=page]", "aria-current", "page"] }],
});
