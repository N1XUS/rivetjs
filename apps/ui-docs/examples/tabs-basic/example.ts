import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tabs: Usage",
  summary: 'Tabs demo "Usage".',
  tags: ["tabs"],
  status: "experimental",
  frame: { height: 360 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "[role=tab][data-key=overview][aria-selected=true]" },
    { expect: ["[role=tabpanel]", "View your project overview"] },
    { click: "[role=tab][data-key=analytics]" },
    { matches: "[role=tab][data-key=analytics][aria-selected=true]" },
    { expect: ["[role=tabpanel]", "Track your metrics"] },
  ],
});
