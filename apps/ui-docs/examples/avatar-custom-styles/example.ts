import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Avatar: Tailwind CSS",
  summary: 'Avatar demo "Tailwind CSS".',
  tags: ["avatar"],
  status: "experimental",
  frame: { height: 96 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".avatar" }],
});
