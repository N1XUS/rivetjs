import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "HoloCard: Usage",
  summary: "Move the pointer over the card: it tilts toward the pointer, the glare follows it and the face drifts against the tilt.",
  tags: ["holo-card"],
  status: "experimental",
  frame: { height: 560 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#hc-basic .holo-card__shine-pattern",
    },
    {
      hover: "#hc-basic",
    },
  ],
});
