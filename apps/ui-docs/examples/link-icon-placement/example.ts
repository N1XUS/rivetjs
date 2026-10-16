import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Link: Icon Placement",
  summary: 'Link demo "Icon Placement".',
  tags: ["link"],
  status: "experimental",
  frame: { height: 116 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="link"]' }],
});
