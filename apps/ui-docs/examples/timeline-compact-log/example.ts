import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Timeline: Compact Log",
  summary: 'size="sm" and density="compact" for dense logs: small dots, tight rhythm, one line per event.',
  tags: ["timeline"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#timeline-log.timeline--sm.timeline--compact",
    },
  ],
});
