import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorSwatchPicker",
  summary: "A grid of ColorSwatchPickerItems over a Signal: click or arrow keys + Enter select a color; data-selected styles the chosen swatch.",
  tags: ["color-swatch-picker", "color-swatch", "signal", "tailwind"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#swatches", "aria-label", "Color swatches"] },
    { attr: ["#swatches [data-key='#3B82F6FF']", "aria-selected", "true"] },
    { click: "#swatches [data-key='#EF4444FF']" },
    { expect: ["#picked", "#EF4444"] },
    { key: "ArrowRight" },
    { key: "Enter" },
    { expect: ["#picked", "#F59E0B"] },
    { attr: ["#swatches [data-key='#F59E0BFF']", "data-selected", "true"] },
  ],
});
