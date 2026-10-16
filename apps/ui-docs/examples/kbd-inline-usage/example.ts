import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Kbd: Inline Usage",
  summary: 'Kbd demo "Inline Usage".',
  tags: ["kbd"],
  status: "experimental",
  frame: { height: 200 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".kbd" }],
});
