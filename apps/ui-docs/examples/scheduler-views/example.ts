import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Scheduler: Views",
  summary: "Navigate the same plan in month, week and day views, with a visible controlled view readout.",
  tags: ["scheduler", "views"],
  status: "experimental",
  frame: {
    height: 640,
    auto: true,
  },
  show: ["src/routes/index.tsx"],
  test: [
    {
      click: '[data-slot="scheduler"] [role="radio"]:nth-child(2)',
    },
    {
      attr: ["#planner", "data-view", "week"],
    },
    {
      expect: ["#view", "Active view: week"],
    },
    {
      click: '[data-slot="scheduler"] [role="radio"]:nth-child(3)',
    },
    {
      attr: ["#planner", "data-view", "day"],
    },
  ],
});
