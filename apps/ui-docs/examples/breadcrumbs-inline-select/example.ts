import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Breadcrumbs: Inline Select",
  summary: "Rivet addition: an InlineSelect as a breadcrumb (Workspace / Project switcher / Settings); the trail keeps its separators and the current page.",
  tags: ["breadcrumbs", "inline-select"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "[data-slot=breadcrumbs-item]:nth-child(2) [data-slot=inline-select-trigger]" },
    { matches: "[data-slot=breadcrumbs-item]:nth-child(2) [data-slot=breadcrumbs-separator]" },
    { attr: ["[data-slot=breadcrumbs-item]:last-child [aria-current]", "aria-current", "page"] },
    { click: "[data-slot=inline-select-trigger]" },
    { click: "[role=option][data-key=billing]" },
    { expect: [".inline-select__value", "Billing service"] },
    { expect: ["#project-settings", "Settings of Billing service"] },
  ],
});
