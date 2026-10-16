import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Sidebar: resizable",
  summary:
    "resizable adds a window-splitter handle on the panel edge: drag it (clamped to minWidth / maxWidth; below half the minimum it collapses), focus it for the arrow keys, Home, End and Enter, double-click to reset.",
  tags: ["sidebar", "navigation", "layout"],
  status: "experimental",
  frame: { height: 420, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ['[data-slot="sidebar-resize-handle"]', "aria-valuemin", "192"] },
    { press: ['[data-slot="sidebar-resize-handle"]', "End"] },
    { attr: ['[data-slot="sidebar-resize-handle"]', "aria-valuenow", "384"] },
    { expect: ["#sbr-width", "384px"] },
    { press: ['[data-slot="sidebar-resize-handle"]', "Enter"] },
    { attr: ['[data-slot="sidebar"]', "data-collapsible", "icon"] },
    { press: ['[data-slot="sidebar-resize-handle"]', "Enter"] },
    { attr: ['[data-slot="sidebar"]', "data-state", "expanded"] },
  ],
});
