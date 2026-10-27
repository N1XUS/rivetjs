import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Timeline: Version History",
  summary: "Releases as a timeline: version Chips, dates and a list of changes; the latest release is current.",
  tags: ["timeline"],
  status: "experimental",
  frame: { height: 440 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#timeline-versions [aria-current=true]", "2.4.0"],
    },
  ],
});
