import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Kbd: Instructional Text",
  summary: 'Kbd demo "Instructional Text".',
  tags: ["kbd"],
  status: "experimental",
  frame: { height: 236 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".kbd" }],
});
