import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "PressableFeedback: With Hold Confirm",
  summary: "Highlight, Ripple and HoldConfirm together on one pressable: hold to unlock, the overlay stays (resetOnComplete={false}).",
  tags: ["pressable-feedback"],
  status: "experimental",
  frame: { height: 240 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#pf-with-hold-status", "Door locked"],
    },
    {
      longpress: ["#pf-with-hold", 1200],
    },
    {
      expect: ["#pf-with-hold-status", "Door unlocked"],
    },
    {
      attr: ["#pf-with-hold .pressable-feedback__hold-confirm", "data-complete", "true"],
    },
  ],
});
