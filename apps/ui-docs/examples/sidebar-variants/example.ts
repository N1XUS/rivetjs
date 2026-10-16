import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Sidebar: variants and side",
  summary: 'variant="sidebar" (edge panel), "floating" (raised card) and "inset" (the page sits in a card); side="right" mirrors.',
  tags: ["sidebar", "navigation"],
  status: "experimental",
  frame: { height: 420, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ['[data-slot="sidebar"]', "data-variant", "sidebar"] },
    { click: "#sbv-floating" },
    { attr: ['[data-slot="sidebar"]', "data-variant", "floating"] },
    { click: "#sbv-inset" },
    { attr: ['[data-slot="sidebar"]', "data-variant", "inset"] },
    { click: "#sbv-side" },
    { attr: ['[data-slot="sidebar"]', "data-side", "right"] },
  ],
});
