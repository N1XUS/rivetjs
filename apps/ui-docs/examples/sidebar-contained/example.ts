import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Sidebar: Contained in a panel",
  summary:
    "Sidebar.Provider contained keeps the sidebar inside its parent (a Card here) instead of the viewport: the panel sets the height, the sidebar collapses to icons inside it and the backgrounds stay the card's.",
  tags: ["sidebar", "card", "navigation"],
  status: "experimental",
  frame: { height: 420, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "#sbc-panel .sidebar-wrapper--contained" },
    { click: "#sbc-trigger" },
    { attr: ['#sbc-panel [data-slot="sidebar"]', "data-state", "collapsed"] },
    { hover: "#sbc-inbox" },
    { expect: ["[role=tooltip]", "Inbox"] },
    { press: ["#sbc-trigger", "Enter"] },
    { attr: ['#sbc-panel [data-slot="sidebar"]', "data-state", "expanded"] },
  ],
});
