import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Timeline: Studio Review",
  summary: "Review activity with avatars as markers and Chips for the decision, inside Timeline.Content.",
  tags: ["timeline"],
  status: "experimental",
  frame: { height: 460 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#timeline-review", "approved"],
    },
  ],
});
