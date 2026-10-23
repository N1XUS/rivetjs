import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Scheduler: Custom event contents",
  summary: "Typed meeting payloads render owner initials, rooms and titles while the scheduler keeps activation and keyboard behavior.",
  tags: ["scheduler", "custom-event"],
  status: "experimental",
  frame: {
    height: 640,
    auto: true,
  },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    {
      expect: ['[data-rv-event-id="roadmap"]', "Ada"],
    },
    {
      press: ['[data-rv-event-id="roadmap"]', "Enter"],
    },
    {
      expect: ["#meeting", "Roadmap in Sky, hosted by Ada"],
    },
  ],
});
