import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tabs: Tailwind CSS",
  summary: 'Tabs demo "Tailwind CSS".',
  tags: ["tabs"],
  status: "experimental",
  frame: { height: 240 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "[role=tab][data-key=monthly][aria-selected=true]" },
    { expect: ["[role=tabpanel]", "Billed monthly"] },
    { click: "[role=tab][data-key=yearly]" },
    { matches: "[role=tab][data-key=yearly][aria-selected=true]" },
    { expect: ["[role=tabpanel]", "Save 20%"] },
  ],
});
