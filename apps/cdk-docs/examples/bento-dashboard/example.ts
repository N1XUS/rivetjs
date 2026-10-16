import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Bento: dashboard tiles",
  summary:
    "Tiles with colSpan / rowSpan packed dense on the server (the same placement as CSS grid-auto-flow: dense), placed with inline CSS; spans change per breakpoint; arrow keys move by visual position, Enter runs onAction.",
  tags: ["bento", "grid", "dashboard", "tailwind"],
  status: "experimental",
  frame: { height: 520 },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["#dashboard", "role", "grid"] }, { click: '#dashboard [data-key="orders"]' }, { expect: ["#opened", "orders"] }],
});
