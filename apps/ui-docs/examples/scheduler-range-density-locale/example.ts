import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Scheduler: Range selection, density and locale",
  summary: "Select empty slots to create events, activate a slot for a quick block, and change density and locale live.",
  tags: ["scheduler", "range-density-locale"],
  status: "experimental",
  frame: {
    height: 640,
    auto: true,
  },
  show: ["src/routes/index.tsx"],
  test: [
    {
      press: ['[data-rv-day-index="0"][data-rv-minutes="480"]', "Shift+ArrowDown"],
    },
    {
      key: "Enter",
    },
    {
      expect: ["#selection", "Created Block 1 by keyboard"],
    },
    {
      matches: '[data-rv-event-id="range-1"]',
    },
    {
      press: ['[data-rv-day-index="1"][data-rv-minutes="660"]', "Space"],
    },
    {
      expect: ["#selection", "Created Quick 2"],
    },
    {
      click: "#compact",
    },
    {
      expect: ["#density", "Density: compact"],
    },
    {
      click: "#locale",
    },
    {
      expect: ["#locale", "de-DE"],
    },
    {
      name: [".rv-SchedulerTimeGrid-day-header", "Montag"],
    },
  ],
});
