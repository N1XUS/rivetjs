import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Timeline: Incident Response",
  summary: "An incident history with status tones (danger, warning, success) and icon markers.",
  tags: ["timeline"],
  status: "experimental",
  frame: { height: 480 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#timeline-incident [data-status=danger]",
    },
  ],
});
