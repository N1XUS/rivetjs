import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "HoverCard: Custom Delays",
  summary: "openDelay and closeDelay tune the timing: instant, the default 700 / 300 ms, or slow.",
  tags: ["hover-card"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      hover: "#hc-delay-instant",
    },
    {
      matches: "[data-slot=hover-card-content][aria-label='Instant delay']",
    },
  ],
});
