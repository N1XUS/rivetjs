import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tabs: With Separator",
  summary: 'Tabs demo "With Separator".',
  tags: ["tabs"],
  status: "experimental",
  frame: { height: 360 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "[role=tab][data-key=analytics] [data-slot=tabs-separator][aria-hidden=true]" },
    { click: "[role=tab][data-key=reports]" },
    { matches: "[role=tab][data-key=reports][aria-selected=true]" },
    { expect: ["[role=tabpanel]", "Generate and download"] },
  ],
});
