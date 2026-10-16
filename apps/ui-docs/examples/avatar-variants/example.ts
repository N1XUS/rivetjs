import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Avatar: Variants",
  summary: 'Avatar demo "Variants".',
  tags: ["avatar"],
  status: "experimental",
  frame: { height: 369 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".avatar" }],
});
