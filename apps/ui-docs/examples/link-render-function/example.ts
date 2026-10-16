import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Link: Render Function",
  summary: 'Link demo "Render Function".',
  tags: ["link"],
  status: "experimental",
  frame: { height: 96 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "span[data-slot=link][data-custom=foo]" }],
});
