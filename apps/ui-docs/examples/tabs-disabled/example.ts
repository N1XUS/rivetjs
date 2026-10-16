import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tabs: Disabled Tab",
  summary: 'Tabs demo "Disabled Tab".',
  tags: ["tabs"],
  status: "experimental",
  frame: { height: 360 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "[role=tab][data-key=disabled][aria-disabled=true]" },
    { click: "[role=tab][data-key=available]" },
    { matches: "[role=tab][data-key=available][aria-selected=true]" },
    { expect: ["[role=tabpanel]", "also available"] },
  ],
});
