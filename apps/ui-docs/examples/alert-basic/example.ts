import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Alert: Usage",
  summary: 'Alert demo "Usage".',
  tags: ["alert"],
  status: "experimental",
  frame: { height: 660 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="alert-root"]' }],
});
