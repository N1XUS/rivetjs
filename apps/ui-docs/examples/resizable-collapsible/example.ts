import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Resizable: Collapsible panels",
  summary: "`collapsible` + `collapsedSize` let a panel snap closed past its minimum; `usePanelRef()` collapses and expands it from a button.",
  tags: ["resizable"],
  status: "experimental",
  frame: { height: 280, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#nav-state", "Expanded"] },
    { click: "#toggle-nav" },
    { expect: ["#nav-state", "Collapsed"] },
    { press: ["#nav-handle", "Enter"] },
    { expect: ["#nav-state", "Expanded"] },
  ],
});
