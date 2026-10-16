import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Kbd: Navigation Keys",
  summary: 'Kbd demo "Navigation Keys".',
  tags: ["kbd"],
  status: "experimental",
  frame: { height: 120 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".kbd" }],
});
