import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Bento: feature highlights",
  summary: 'rowHeight="auto": a native CSS grid (grid-auto-flow: dense) sized by its content, list semantics for a marketing grid; no script at all.',
  tags: ["bento", "grid", "features", "css-grid", "tailwind"],
  status: "experimental",
  frame: { height: 560 },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#features", "role", "list"] },
    {
      matches:
        '#features [data-rv-item][data-key="resume"][style*="grid-column:span 2"], #features [data-rv-item][data-key="resume"][style*="grid-column: span 2"]',
    },
  ],
});
