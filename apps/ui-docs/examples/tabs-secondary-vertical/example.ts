import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tabs: Secondary Variant Vertical",
  summary: 'Tabs demo "Secondary Variant Vertical".',
  tags: ["tabs"],
  status: "experimental",
  frame: { height: 400 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: ".tabs.tabs--secondary[data-orientation=vertical]" },
    { click: "[role=tab][data-key=billing]" },
    { expect: ["[role=tabpanel]", "subscription and payment methods"] },
  ],
});
