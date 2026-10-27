import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Button: Adding Ripple Effect",
  summary: "A Button with a nested PressableFeedback.Ripple: an M3-style ripple from the press point (Space / Enter: centred).",
  tags: ["button", "pressable-feedback"],
  status: "experimental",
  frame: { height: 96 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: '[data-slot="button"]' },
    { click: '[data-slot="button"]' },
    { attr: ['[data-slot="button"] [data-slot="pressable-feedback-ripple"]', "data-pressed", "true"] },
  ],
});
