import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Switch with plain CSS",
  summary: "A plain stylesheet for .rv-Switch: a track and thumb drawn from the label's data-selected, data-pressed, data-focus-visible and data-disabled.",
  tags: ["switch", "css", "styling"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [
    { matches: "label.rv-Switch:has(#css-sw)" },
    { click: "label:has(#css-sw)" },
    { matches: 'label.rv-Switch[data-selected="true"]:has(#css-sw)' },
    { matches: 'label.rv-Switch[data-disabled="true"]:has(#css-beta)' },
  ],
});
