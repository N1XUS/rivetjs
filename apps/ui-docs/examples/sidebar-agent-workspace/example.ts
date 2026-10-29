import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Sidebar: agent workspace",
  summary: "A coding-agent workspace: tasks grouped by repository in collapsible trees, a status dot and diff size per task, and the open task's details.",
  tags: ["sidebar", "navigation", "tree", "ai"],
  status: "experimental",
  frame: { height: 520, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#saw-repo-web", "aria-expanded", "true"] },
    { attr: ["#saw-repo-infra", "aria-expanded", "false"] },
    { attr: ["#saw-upload-test", "aria-current", "page"] },
    { click: "#saw-n-plus-one" },
    { attr: ["#saw-n-plus-one", "aria-current", "page"] },
    { expect: ["#saw-title", "Remove N+1 in invoices"] },
    { expect: ["#saw-branch", "perf/invoice-query"] },
    { expect: ["#saw-state", "Needs review"] },
    { click: "#saw-repo-infra" },
    { attr: ["#saw-repo-infra", "aria-expanded", "true"] },
    { click: "#saw-pg-17" },
    { expect: ["#saw-repo", "northwind/infra"] },
    { click: "#saw-repo-web" },
    { attr: ["#saw-repo-web", "aria-expanded", "false"] },
    { click: "#saw-trigger" },
    { attr: ['[data-slot="sidebar"]', "data-state", "collapsed"] },
  ],
});
