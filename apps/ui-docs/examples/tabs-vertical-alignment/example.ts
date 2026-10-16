import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tabs: Alignment",
  summary: 'Tabs demo "Alignment".',
  tags: ["tabs"],
  status: "experimental",
  frame: { height: 440 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: ".tabs.tabs--align-start[data-orientation=vertical]" },
    { click: "[role=tab][data-key=privacy]" },
    { expect: ["[role=tabpanel]", "Control what you share"] },
  ],
});
