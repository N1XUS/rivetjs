import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Scheduler: Views and two-way binding",
  summary: "Two-way view, date and event signals with external view controls and an Add event action.",
  tags: ["scheduler", "views-binding"],
  status: "experimental",
  frame: {
    height: 640,
    auto: true,
  },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    {
      expect: ["#binding", "View: week"],
    },
    {
      click: "#choose-day",
    },
    {
      attr: ["#planner", "data-view", "day"],
    },
    {
      click: "#add-event",
    },
    {
      expect: ["#binding", "Events: 5"],
    },
    {
      matches: '[data-rv-event-id="added-4"]',
    },
  ],
});
