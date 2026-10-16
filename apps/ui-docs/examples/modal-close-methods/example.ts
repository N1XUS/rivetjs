import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Modal: Close Methods",
  summary: 'Modal demo "Close Methods".',
  tags: ["modal"],
  status: "experimental",
  frame: { height: 520 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: ".max-w-2xl > div:nth-child(2) > button" },
    { matches: "[role=dialog]" },
    { click: "[data-slot=modal-footer] button:nth-of-type(2)" },
    { absent: "[role=dialog]" },
  ],
});
