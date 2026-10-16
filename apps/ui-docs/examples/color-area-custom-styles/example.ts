import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorArea: Tailwind CSS",
  summary: 'ColorArea demo "Tailwind CSS".',
  tags: ["color-area"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=color-area].rounded-3xl" }],
});
