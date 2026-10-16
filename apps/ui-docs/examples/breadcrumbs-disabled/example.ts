import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Breadcrumbs: Disabled State",
  summary: 'Breadcrumbs demo "Disabled State".',
  tags: ["breadcrumbs"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[role=link][aria-disabled=true]" }],
});
