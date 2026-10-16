import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Avatar: Fallback Content",
  summary: 'Avatar demo "Fallback Content".',
  tags: ["avatar"],
  status: "experimental",
  frame: { height: 96 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".avatar" }],
});
