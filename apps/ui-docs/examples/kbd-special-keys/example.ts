import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Kbd: Special Keys",
  summary: 'Kbd demo "Special Keys".',
  tags: ["kbd"],
  status: "experimental",
  frame: { height: 152 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".kbd" }],
});
