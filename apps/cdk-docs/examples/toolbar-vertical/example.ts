import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Vertical and right-to-left toolbars",
  summary: "orientation vertical moves with Up and Down; in right-to-left text ArrowLeft moves forward. Tailwind's orientation-vertical: variant lays it out.",
  tags: ["toolbar", "keyboard", "tailwind", "rtl"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#vt", "aria-orientation", "vertical"] },
    { attr: ["#vt", "data-orientation", "vertical"] },
    { attr: ["#vt", "data-rk", "ArrowUp ArrowDown"] },
    { press: ["#vt-cut", "ArrowRight"] },
    { focused: "#vt-cut" },
    { key: "ArrowDown" },
    { focused: "#vt-copy" },
    { key: "ArrowDown" },
    { focused: "#vt-paste" },
    { key: "ArrowUp" },
    { focused: "#vt-copy" },
    { press: ["#rt-one", "ArrowLeft"] },
    { focused: "#rt-two" },
    { key: "ArrowRight" },
    { focused: "#rt-one" },
  ],
});
