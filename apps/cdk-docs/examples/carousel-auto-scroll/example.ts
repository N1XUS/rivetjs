import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Auto scroll",
  summary: "embla's Auto Scroll example: the AutoScroll plugin moves a looping track at a constant speed once Start is pressed; hover pauses it.",
  tags: ["carousel", "auto-scroll", "tailwind"],
  status: "experimental",
  frame: { height: 244, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#ticker", "data-ready", "true"] },
    { name: ["#play", "Start auto scroll"] },
    { click: "#play" },
    { name: ["#play", "Stop auto scroll"] },
    { attr: ["#play", "data-rotating", "true"] },
    { click: "#play" },
    { name: ["#play", "Start auto scroll"] },
  ],
});
