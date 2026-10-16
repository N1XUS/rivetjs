import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Sidebar with grouped navigation",
  summary:
    "Port of shadcn/ui block sidebar-01: a version switcher menu, a search input, labelled groups of links (one isActive), a rail and a trigger that collapses the sidebar off canvas.",
  tags: ["sidebar", "navigation", "blocks"],
  status: "experimental",
  frame: { height: "xl" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ['[data-slot="sidebar"]', "data-state", "expanded"] },
    { attr: ['[data-slot="sidebar-menu-button"][data-active="true"]', "href", "#"] },
    { expect: ['[data-slot="sidebar-menu-button"][data-active="true"]', "Data Fetching"] },
    // Version switcher: a single-selection menu.
    { click: "#s01-version" },
    { matches: "#s01-versions" },
    { click: '#s01-versions [data-key="1.1.0-alpha"]' },
    { expect: ["#s01-version-value", "v1.1.0-alpha"] },
    { absent: "#s01-versions" },
    // Trigger, Ctrl+B, rail: off-canvas collapse.
    { click: "#s01-trigger" },
    { attr: ['[data-slot="sidebar"]', "data-state", "collapsed"] },
    { attr: ['[data-slot="sidebar"]', "data-collapsible", "offcanvas"] },
    { key: "Control+b" },
    { attr: ['[data-slot="sidebar"]', "data-state", "expanded"] },
    { click: "#s01-rail" },
    { attr: ['[data-slot="sidebar"]', "data-state", "collapsed"] },
  ],
});
