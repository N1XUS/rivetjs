import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "PressableFeedback: With Highlight",
  summary: "A settings list where every row is a PressableFeedback with only the Highlight layer: a quiet hover and press tint.",
  tags: ["pressable-feedback"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      name: ["#pf-row-notifications", "Notifications"],
    },
    {
      click: "#pf-row-notifications",
    },
    {
      expect: ["#pf-with-highlight-status", "Opened: Notifications"],
    },
  ],
});
