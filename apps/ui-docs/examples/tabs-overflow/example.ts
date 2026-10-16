import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tabs: Overflow",
  summary: 'Tabs demo "Overflow".',
  tags: ["tabs"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: ".tabs__list-container__scroll-next" },
    { matches: "[data-slot=scroll-shadow][data-right-scroll=true]" },
    { click: "[role=tab][data-key=analytics]" },
    { expect: ["[role=tabpanel]", "Analytics panel content."] },
  ],
});
