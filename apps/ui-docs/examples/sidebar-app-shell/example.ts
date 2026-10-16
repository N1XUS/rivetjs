import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Sidebar: complex app shell",
  summary:
    "An app shell: workspace header, a navigation group with a chip, a project tree with guide lines, hover actions and current-page links, and a user footer.",
  tags: ["sidebar", "navigation", "tree", "app-shell"],
  status: "experimental",
  frame: { height: 480, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#sas-projects-trigger", "aria-expanded", "true"] },
    { click: "#sas-projects-trigger" },
    { attr: ["#sas-projects-trigger", "aria-expanded", "false"] },
    { click: "#sas-projects-trigger" },
    { click: "#sas-roadmap" },
    { attr: ["#sas-roadmap", "aria-current", "page"] },
    { expect: ["#sas-title", "Roadmap"] },
    { expect: ["#sas-inbox-chip", "12"] },
    { click: "#sas-trigger" },
    { attr: ['[data-slot="sidebar"]', "data-state", "collapsed"] },
  ],
});
