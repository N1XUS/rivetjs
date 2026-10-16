import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Kbd: Tailwind CSS",
  summary: 'Kbd demo "Tailwind CSS".',
  tags: ["kbd"],
  status: "experimental",
  frame: { height: 96 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".kbd" }],
});
