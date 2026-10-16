import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorArea with plain CSS",
  summary: "styles.css targets the default rv-ColorArea / rv-ColorThumb classes and their data-focus-visible / data-dragging / data-disabled states.",
  tags: ["color-area", "css", "styling"],
  status: "experimental",
  frame: { height: 192, auto: true },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [
    { attr: ["#css-area [role=group]", "class", "rv-ColorArea"] },
    { attr: [".rv-ColorThumb", "class", "rv-ColorThumb"] },
    { press: ["#css-area input", "ArrowLeft"] },
    { attr: [".rv-ColorThumb", "data-focus-visible", "true"] },
  ],
});
