import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Separator: Render Function",
  summary: 'Separator demo "Render Function".',
  tags: ["separator"],
  status: "experimental",
  frame: { height: 161 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=separator][data-custom=foo]" }],
});
