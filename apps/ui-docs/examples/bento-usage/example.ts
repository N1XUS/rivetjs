import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Bento: Usage",
  summary:
    "Rivet addition: dashboard tiles with column and row spans, packed dense on the server; spans change with the container width; Enter or a click runs onAction.",
  tags: ["bento", "grid", "dashboard", "card"],
  status: "experimental",
  frame: { height: 540 },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["#bento-usage", "role", "grid"] }, { click: '#bento-usage [data-key="orders"]' }, { expect: ["#bento-usage-opened", "orders"] }],
});
