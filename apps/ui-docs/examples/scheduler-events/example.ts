import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Scheduler: Events",
  summary: "Semantic event colors, a custom CSS color, overlap placement and event activation on one team calendar.",
  tags: ["scheduler", "events"],
  status: "experimental",
  frame: {
    height: 640,
    auto: true,
  },
  show: ["src/routes/index.tsx"],
  test: [
    {
      press: ['[data-rv-event-id="review"]', "Enter"],
    },
    {
      expect: ["#selected", "Selected: Design review"],
    },
    {
      press: ['[data-rv-event-id="support"]', "Space"],
    },
    {
      expect: ["#selected", "Selected: Support rotation"],
    },
  ],
});
