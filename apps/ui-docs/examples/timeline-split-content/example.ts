import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Timeline: Split Content",
  summary: "On a centred axis, two content parts per item: the date on the start side, the event on the end side.",
  tags: ["timeline"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#timeline-split [data-side=start]", "Mon 6"],
    },
  ],
});
