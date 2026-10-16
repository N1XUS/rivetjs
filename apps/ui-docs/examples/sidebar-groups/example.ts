import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Sidebar: groups",
  summary: "Labelled groups with group actions; the Pinned group keeps the mobile sheet open on a press (closeMobileOnAction false).",
  tags: ["sidebar", "navigation", "groups"],
  status: "experimental",
  frame: { height: 480, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: '[data-slot="sidebar-group"] + [data-slot="sidebar-group"]' },
    { expect: ['[data-slot="sidebar-group-label"]', "Platform"] },
    { click: "#sg-docs" },
    { attr: ["#sg-docs", "aria-current", "page"] },
  ],
});
