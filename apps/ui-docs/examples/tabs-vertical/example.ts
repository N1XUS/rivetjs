import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tabs: Vertical",
  summary: 'Tabs demo "Vertical".',
  tags: ["tabs"],
  status: "experimental",
  frame: { height: 400 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: ".tabs[data-orientation=vertical]" },
    { matches: "[role=tab][data-key=account][aria-selected=true]" },
    { click: "[role=tab][data-key=security]" },
    { matches: "[role=tab][data-key=security][aria-selected=true]" },
    { expect: ["[role=tabpanel]", "two-factor authentication"] },
  ],
});
