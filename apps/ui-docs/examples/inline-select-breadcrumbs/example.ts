import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "InlineSelect: Breadcrumb Switcher",
  summary: "An InlineSelect as a Breadcrumbs item: switch the project without leaving the trail; the item separator stays.",
  tags: ["inline-select"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "[data-slot=breadcrumbs-item]:nth-child(2) [data-slot=breadcrumbs-separator]" },
    { click: "[data-slot=inline-select-trigger]" },
    { click: "[role=option][data-key=api]" },
    { expect: [".inline-select__value", "Public API"] },
  ],
});
