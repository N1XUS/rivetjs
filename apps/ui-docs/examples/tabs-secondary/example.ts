import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tabs: Secondary Variant",
  summary: 'Tabs demo "Secondary Variant".',
  tags: ["tabs"],
  status: "experimental",
  frame: { height: 360 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: ".tabs.tabs--secondary" },
    { click: "[role=tab][data-key=analytics]" },
    { matches: "[role=tab][data-key=analytics][aria-selected=true]" },
    { expect: ["[role=tabpanel]", "Track your metrics"] },
  ],
});
