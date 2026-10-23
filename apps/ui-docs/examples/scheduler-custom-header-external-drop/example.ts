import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Scheduler: Custom header and external backlog",
  summary: "A localized header drives navigation; connected CDK backlog items create events from the drop range and stay under application ownership.",
  tags: ["scheduler", "custom-header-external-drop"],
  status: "experimental",
  frame: {
    height: 640,
    auto: true,
  },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#custom-title", "October 2026"],
    },
    {
      click: "#next",
    },
    {
      expect: ["#custom-title", "November 2026"],
    },
    {
      click: "#reset",
    },
    {
      expect: ["#custom-title", "October 2026"],
    },
    {
      click: "#custom-week",
    },
    {
      attr: ["#planner", "data-view", "week"],
    },
  ],
});
