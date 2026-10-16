import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Label: Usage",
  summary: 'Label demo "Usage".',
  tags: ["label"],
  status: "experimental",
  frame: { height: 116 },
  show: ["src/routes/index.tsx"],
  test: [{ name: ["#name", "Name"] }],
});
