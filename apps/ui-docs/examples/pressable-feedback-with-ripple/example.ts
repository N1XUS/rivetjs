import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "PressableFeedback: With Ripple",
  summary: "Round icon-only media controls with the Ripple layer; the play button uses a stronger pressedOpacity.",
  tags: ["pressable-feedback"],
  status: "experimental",
  frame: { height: 240 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      name: ["#pf-ripple-play", "Play"],
    },
    {
      click: "#pf-ripple-play",
    },
    {
      attr: ["#pf-ripple-play .pressable-feedback__ripple", "data-pressed", "true"],
    },
    {
      name: ["#pf-ripple-play", "Pause"],
    },
    {
      click: "#pf-ripple-next",
    },
    {
      expect: ["#pf-with-ripple-track", "Track 2 of 12"],
    },
  ],
});
