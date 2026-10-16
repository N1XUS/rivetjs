import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Modal: Controlled State",
  summary: 'Modal demo "Controlled State".',
  tags: ["modal"],
  status: "experimental",
  frame: { height: 520 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["span.font-mono", "closed"] },
    { click: "button" },
    { matches: "[role=dialog]" },
    { expect: ["span.font-mono", "open"] },
    { key: "Escape" },
    { absent: "[role=dialog]" },
    { expect: ["span.font-mono", "closed"] },
  ],
});
