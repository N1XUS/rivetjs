import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorPicker composition",
  summary: "A ColorPicker keeps a ColorArea, a hue ColorSlider, a hex ColorField, a ColorSwatch and a ColorSwatchPicker in sync over one Signal.",
  tags: ["color-picker", "color-area", "color-slider", "color-field", "color-swatch-picker", "tailwind"],
  status: "experimental",
  frame: { height: 350, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#picker-field input", "value", "#2563EB"] },
    { click: "#picker-swatches [data-key='#DC2626FF']" },
    { expect: ["#picker-value", "#DC2626"] },
    { attr: ["#picker-swatch", "aria-label", "vibrant red"] },
    { fill: ["#picker-field input", "#16a34a"] },
    { press: ["#picker-field input", "Enter"] },
    { expect: ["#picker-value", "#16A34A"] },
    { press: ["#picker-hue input", "PageUp"] },
    { expect: ["#picker-value", "#16A36D"] },
  ],
});
