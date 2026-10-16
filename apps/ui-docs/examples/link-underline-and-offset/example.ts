import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Link: Text Decoration with Tailwind CSS",
  summary: 'Link demo "Text Decoration with Tailwind CSS".',
  tags: ["link"],
  status: "experimental",
  frame: { height: 444 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="link"]' }],
});
