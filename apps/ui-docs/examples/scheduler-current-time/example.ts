import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Scheduler: Current time indicator",
  summary: "Use Today to navigate from a fixed build-time anchor to the current date, then toggle the visible minute clock.",
  tags: ["scheduler", "current-time"],
  status: "experimental",
  frame: {
    height: 640,
    auto: true,
  },
  show: ["src/routes/index.tsx"],
  test: [
    {
      click: ".scheduler__navigation > button",
    },
    {
      matches: ".rv-SchedulerTimeGrid-now",
    },
    {
      click: "#clock-toggle",
    },
    {
      expect: ["#clock-toggle", "off"],
    },
    {
      absent: ".rv-SchedulerTimeGrid-now",
    },
  ],
});
