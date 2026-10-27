import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Timeline: Centered Milestones",
  summary: 'axis="center" with placement="alternate": milestones alternate left and right of a centred rail.',
  tags: ["timeline"],
  status: "experimental",
  frame: { height: 460 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#timeline-centered.timeline--center.timeline--placement-alternate",
    },
  ],
});
