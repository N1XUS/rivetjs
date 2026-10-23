import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Scheduler: Working hours and slot sizes",
  summary: "Change slot granularity and hidden weekends while the time axis and business-hours shading update live.",
  tags: ["scheduler", "working-hours"],
  status: "experimental",
  frame: {
    height: 640,
    auto: true,
  },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: '[data-outside-business="true"]',
    },
    {
      click: "#hour-slots",
    },
    {
      expect: ["#slot-size", "Slot: 60 minutes"],
    },
    {
      absent: '[data-rv-minutes="495"]',
    },
    {
      click: "#weekends",
    },
    {
      matches: '[data-rv-day-index="6"][data-rv-minutes="480"]',
    },
  ],
});
