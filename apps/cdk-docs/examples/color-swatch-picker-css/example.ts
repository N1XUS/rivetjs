import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorSwatchPicker with plain CSS",
  summary:
    'layout="stack", defaultValue and onChange; styles.css targets rv-ColorSwatchPicker / rv-ColorSwatchPickerItem and data-selected / data-focus-visible; item render props read the color.',
  tags: ["color-swatch-picker", "css", "events", "render-props"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [
    { attr: ["#stack", "data-layout", "stack"] },
    { attr: ["#stack [data-key='#00FF00FF']", "aria-selected", "true"] },
    { click: "#stack [data-key='#0000FFFF']" },
    { expect: ["#stack-change", "blue"] },
    { expect: ["#stack [data-key='#0000FFFF'] .name", "#0000FF"] },
  ],
});
