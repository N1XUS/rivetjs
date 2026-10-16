import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Kbd: Usage",
  summary: 'Kbd demo "Usage".',
  tags: ["kbd"],
  status: "experimental",
  frame: { height: 96 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".kbd" }],
});
