import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Scheduler: Weekend highlighting",
  summary: "Override locale weekends and hide selected weekdays without changing the event model.",
  tags: ["scheduler", "weekend"],
  status: "experimental",
  frame: {
    height: 640,
    auto: true,
  },
  show: ["src/routes/index.tsx"],
  test: [
    {
      click: "#weekend-definition",
    },
    {
      expect: ["#weekend-definition", "Friday and Saturday"],
    },
    {
      matches: '.rv-SchedulerTimeGrid-all-day-cell[data-rv-day-index="4"][data-weekend="true"]',
    },
    {
      click: "#hide-weekends",
    },
    {
      expect: ["#hide-weekends", "yes"],
    },
    {
      absent: '.rv-SchedulerTimeGrid-all-day-cell[data-rv-day-index="6"]',
    },
  ],
});
