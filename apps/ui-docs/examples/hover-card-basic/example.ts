import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "HoverCard: Usage",
  summary: "Hover or focus the name to preview the profile; the card stays open while the pointer moves into it.",
  tags: ["hover-card"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      attr: ["#hc-basic [data-slot=hover-card-trigger]", "aria-expanded", "false"],
    },
    {
      hover: "#hc-basic [data-slot=hover-card-trigger]",
    },
    {
      matches: "[data-slot=hover-card-content][role=dialog]",
    },
    {
      name: ["[data-slot=hover-card-content]", "Mara Lindqvist"],
    },
  ],
});
