import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Link: Tailwind CSS",
  summary: 'Link demo "Tailwind CSS".',
  tags: ["link"],
  status: "experimental",
  frame: { height: 96 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="link"]' }],
});
