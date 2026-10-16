import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorWheel with plain CSS and events",
  summary: "styles.css targets rv-ColorWheel / rv-ColorWheelTrack / rv-ColorThumb; onChange and onChangeEnd log into outputs; a disabled wheel.",
  tags: ["color-wheel", "css", "events", "disabled"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [
    { press: ["#css-wheel input", "ArrowLeft"] },
    { expect: ["#wheel-change", "change 239"] },
    { expect: ["#wheel-end", "end 239"] },
    { attr: ["#css-wheel .rv-ColorThumb", "data-focus-visible", "true"] },
    { attr: ["#off-wheel input", "disabled", ""] },
  ],
});
