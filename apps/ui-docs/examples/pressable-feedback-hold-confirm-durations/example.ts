import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "PressableFeedback: Hold Confirm Durations",
  summary: "duration sets how long a hold takes to confirm (0.5 s, 1.5 s, 3 s); releaseDuration sets how fast an early release snaps back.",
  tags: ["pressable-feedback"],
  status: "experimental",
  frame: { height: 240 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#pf-hold-durations-status", "Nothing confirmed yet"],
    },
    {
      longpress: ["#pf-hold-500", 900],
    },
    {
      expect: ["#pf-hold-durations-status", "Confirmed: Quick"],
    },
  ],
});
