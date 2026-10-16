import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Alert: Tailwind CSS",
  summary: 'Alert demo "Tailwind CSS".',
  tags: ["alert"],
  status: "experimental",
  frame: { height: 166 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="alert-root"]' }],
});
