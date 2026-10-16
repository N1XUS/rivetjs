import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tabs: Render Function",
  summary: 'Tabs demo "Render Function".',
  tags: ["tabs"],
  status: "experimental",
  frame: { height: 240 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "div[data-custom=foo][data-slot=tabs]" },
    { matches: "a[role=tab][data-key=components][href='/docs/react/components']" },
    { matches: "[role=tab][data-key=getting-started][aria-selected=true]" },
  ],
});
