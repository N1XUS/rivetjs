import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Timeline: Usage",
  summary: "A read-only chronology: an ordered list of events with markers, connectors and semantic content; the current event has aria-current.",
  tags: ["timeline"],
  status: "experimental",
  frame: { height: 360 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#timeline-basic [aria-current=true]", "Out for delivery"],
    },
  ],
});
