import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "PressableFeedback: Standalone Ripple",
  summary: "Ripple outside a PressableFeedback root follows its parent's own press: here inside ui Buttons, with custom opacity and duration.",
  tags: ["pressable-feedback"],
  status: "experimental",
  frame: { height: 200 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      click: "#pf-standalone-ripple",
    },
    {
      attr: ["#pf-standalone-ripple .pressable-feedback__ripple", "data-pressed", "true"],
    },
  ],
});
