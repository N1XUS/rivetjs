import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "HoverCard: With Arrow",
  summary: "HoverCard.Arrow points the card at its trigger and turns with the placement.",
  tags: ["hover-card"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      hover: "#hc-arrow [data-slot=hover-card-trigger]",
    },
    {
      matches: "[data-slot=hover-card-content] [data-slot=hover-card-arrow]",
    },
  ],
});
