import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "PressableFeedback: Hold Confirm",
  summary: "Hold to reveal the overlay; onComplete fires when the hold reaches duration (here 1.2 s). Releasing early snaps back over releaseDuration.",
  tags: ["pressable-feedback"],
  status: "experimental",
  frame: { height: 240 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#pf-hold-count", "Deleted 0 times"],
    },
    {
      longpress: ["#pf-hold", 1500],
    },
    {
      expect: ["#pf-hold-count", "Deleted 1 times"],
    },
  ],
});
