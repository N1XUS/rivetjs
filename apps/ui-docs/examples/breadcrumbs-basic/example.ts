import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Breadcrumbs: Usage",
  summary: 'Breadcrumbs demo "Usage".',
  tags: ["breadcrumbs"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ expect: ["[aria-current=page]", "Laptop"] }],
});
