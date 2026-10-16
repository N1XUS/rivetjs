import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Modal: Dismiss Behavior",
  summary: 'Modal demo "Dismiss Behavior".',
  tags: ["modal"],
  status: "experimental",
  frame: { height: 520 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: ".max-w-sm > div:nth-child(2) > button" },
    { matches: "[role=dialog]" },
    { key: "Escape" },
    { matches: "[role=dialog]" },
    { click: "[data-slot=modal-close-trigger]" },
    { absent: "[role=dialog]" },
  ],
});
