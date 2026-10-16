import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Link: Usage",
  summary: 'Link demo "Usage".',
  tags: ["link"],
  status: "experimental",
  frame: { height: 96 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="link"]' }],
});
