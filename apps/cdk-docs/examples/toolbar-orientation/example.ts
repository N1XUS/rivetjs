import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Vertical and RTL Toolbar",
  summary: 'orientation="vertical" moves focus with ArrowUp / ArrowDown; in a right-to-left container a horizontal Toolbar flips ArrowLeft and ArrowRight.',
  tags: ["toolbar", "orientation", "rtl", "keyboard"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#tools-v", "aria-orientation", "vertical"] },
    { attr: ["#tools-v", "data-orientation", "vertical"] },
    { press: ["#v-pen", "ArrowDown"] },
    { focused: "#v-eraser" },
    { key: "ArrowRight" },
    { focused: "#v-eraser" },
    { key: "ArrowUp" },
    { focused: "#v-pen" },
    { press: ["#r-one", "ArrowLeft"] },
    { focused: "#r-two" },
  ],
});
