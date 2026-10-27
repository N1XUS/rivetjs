import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "HoverCard: Controlled",
  summary: "Bind isOpen to a signal: open the card from elsewhere, and read whether it is showing.",
  tags: ["hover-card"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#hc-controlled-state", "Closed"],
    },
    {
      click: "#hc-controlled-toggle",
    },
    {
      matches: "[data-slot=hover-card-content]",
    },
    {
      expect: ["#hc-controlled-state", "Open"],
    },
  ],
});
