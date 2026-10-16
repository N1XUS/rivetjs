import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Sheet: Slack Message Actions",
  summary: "A message-actions sheet: quick reactions on top, a list of actions below.",
  tags: ["sheet"],
  status: "experimental",
  frame: { height: 480 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "button" },
    { matches: "[role=dialog][data-slot=sheet-dialog]" },
    { click: "[data-slot=sheet-body] > div:nth-child(2) > button:nth-child(3)" },
    { absent: "[data-slot=sheet-dialog]" },
    { expect: ["#sheet-actions-last", "Copy link"] },
  ],
});
