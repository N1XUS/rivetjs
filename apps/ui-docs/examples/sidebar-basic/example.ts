import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Sidebar",
  summary: "An app sidebar with a group of menu links next to the page; the trigger and Cmd/Ctrl+B collapse it off canvas.",
  tags: ["sidebar", "navigation"],
  status: "experimental",
  frame: { height: 420, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ['[data-slot="sidebar"]', "data-state", "expanded"] },
    { click: "#sbb-trigger" },
    { attr: ['[data-slot="sidebar"]', "data-state", "collapsed"] },
    { attr: ['[data-slot="sidebar"]', "data-collapsible", "offcanvas"] },
    { key: "Control+b" },
    { attr: ['[data-slot="sidebar"]', "data-state", "expanded"] },
  ],
});
