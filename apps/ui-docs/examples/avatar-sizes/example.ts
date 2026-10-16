import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Avatar: Sizes",
  summary: 'Avatar demo "Sizes".',
  tags: ["avatar"],
  status: "experimental",
  frame: { height: 104 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".avatar" }],
});
