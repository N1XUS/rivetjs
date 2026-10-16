import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Menu with plain CSS",
  summary:
    "A stylesheet for the default rv-Popover / rv-Menu / rv-MenuItem classes plus [aria-expanded], [data-disabled], [data-focused], [data-placement] and [data-entering] / [data-exiting].",
  tags: ["menu", "css", "styling"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [
    { matches: "#css-trigger.rv-Button" },
    { click: "#css-trigger" },
    { matches: ".rv-Popover[data-trigger=MenuTrigger][data-placement=bottom]:has(#css)" },
    { matches: "#css.rv-Menu" },
    { matches: '#css .rv-MenuItem[data-key="new"]' },
    { matches: '#css a.rv-MenuItem[data-key="help"]' },
    { attr: ['#css [data-key="share"]', "aria-disabled", "true"] },
    { key: "Escape" },
    { absent: "#css" },
  ],
});
