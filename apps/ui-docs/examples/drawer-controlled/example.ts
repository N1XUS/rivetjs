import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Drawer: Controlled State",
  summary: 'Drawer demo "Controlled State".',
  tags: ["drawer"],
  status: "experimental",
  frame: { height: 520 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["span.font-mono", "closed"] },
    { click: "button" },
    { matches: "[role=dialog]" },
    { expect: ["span.font-mono", "open"] },
    { click: "[data-slot=drawer-close-trigger]" },
    { absent: "[role=dialog]" },
    { expect: ["span.font-mono", "closed"] },
  ],
});
