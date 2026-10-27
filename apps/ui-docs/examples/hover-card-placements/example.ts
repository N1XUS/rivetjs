import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "HoverCard: Placements",
  summary: "placement puts the card on any side of the trigger; it flips when there is no room.",
  tags: ["hover-card"],
  status: "experimental",
  frame: { height: 340 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      hover: "#hc-placement-bottom",
    },
    {
      attr: ["[data-slot=hover-card-content]", "data-placement", "bottom"],
    },
  ],
});
