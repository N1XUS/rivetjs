import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "AppLayout: Docs site",
  summary: "A documentation layout: search in the navbar, a theme segment, and grouped page navigation in an off-canvas sidebar.",
  tags: ["app-layout", "layout", "docs"],
  status: "experimental",
  frame: { height: 532, auto: true, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [
    { fill: ["#ads-search", "routing"] },
    { attr: ["#ads-search", "value", "routing"] },
    { click: "[aria-label=Theme] [role=radio]:nth-of-type(2)" },
    { attr: ["[aria-label=Theme] [role=radio]:nth-of-type(2)", "aria-checked", "true"] },
  ],
});
