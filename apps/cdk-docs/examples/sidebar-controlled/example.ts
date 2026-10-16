import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Controlled sidebar",
  summary:
    "open as a two-way Signal with onOpenChange, useSidebar() state in a child, side and variant as accessors, plus a menu badge, an outline button and a skeleton item.",
  tags: ["sidebar", "signals"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#sc-status", "state=expanded mobile=false"] },
    { click: "#sc-trigger" },
    { expect: ["#sc-open", "open=false"] },
    { expect: ["#sc-status", "state=collapsed"] },
    { expect: ["#sc-log", "close"] },
    { key: "Control+b" },
    { expect: ["#sc-open", "open=true"] },
    { expect: ["#sc-log", "close open"] },
    // Your own set: no onOpenChange.
    { click: "#sc-close" },
    { attr: ['[data-slot="sidebar"]', "data-state", "collapsed"] },
    { expect: ["#sc-log", "close open"] },
    { click: "#sc-side" },
    { attr: ['[data-slot="sidebar"]', "data-side", "right"] },
    { click: "#sc-variant" },
    { attr: ['[data-slot="sidebar"]', "data-variant", "floating"] },
    { matches: '[data-slot="sidebar-menu-button"][data-variant="outline"]' },
    { matches: '[data-slot="sidebar-menu-skeleton"] [data-sidebar="menu-skeleton-icon"]' },
  ],
});
