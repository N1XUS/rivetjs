import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "PressableFeedback: Usage",
  summary: "A pressable with a hover / press highlight and an M3-style ripple from the press point.",
  tags: ["pressable-feedback"],
  status: "experimental",
  frame: { height: 200 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      name: ["#pf-basic", "Press me"],
    },
    {
      click: "#pf-basic",
    },
    {
      attr: ["#pf-basic .pressable-feedback__ripple", "data-pressed", "true"],
    },
  ],
});
