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
    // Cold: the first pointer move resumes the card and tilts it (UI-BUGS 2026-10-27: it shipped no JS and never moved).
    {
      attr: ["#hc-basic", "data-active", "true"],
    },
  ],
});
