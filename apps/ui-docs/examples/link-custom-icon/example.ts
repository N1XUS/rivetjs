import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Link: Custom Icon",
  summary: 'Link demo "Custom Icon".',
  tags: ["link"],
  status: "experimental",
  frame: { height: 116 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="link"]' }],
});
