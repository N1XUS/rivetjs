import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Avatar: Usage",
  summary: 'Avatar demo "Usage".',
  tags: ["avatar"],
  status: "experimental",
  frame: { height: 96 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".avatar" }],
});
