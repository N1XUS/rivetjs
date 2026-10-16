import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Kbd: Variants",
  summary: 'Kbd demo "Variants".',
  tags: ["kbd"],
  status: "experimental",
  frame: { height: 240 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".kbd" }],
});
