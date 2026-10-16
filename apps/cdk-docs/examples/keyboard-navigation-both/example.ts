import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Both orientations, no Home and End",
  summary: "orientation both: all four arrows move through a row of swatches; homeEnd false leaves Home and End to the page.",
  tags: ["keyboard"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#swatches", "data-rk", "ArrowDown ArrowUp ArrowLeft ArrowRight"] },
    { press: ["#sw-red", "ArrowRight"] },
    { focused: "#sw-green" },
    { key: "ArrowDown" },
    { focused: "#sw-blue" },
    { key: "ArrowDown" },
    { focused: "#sw-red" },
    { key: "ArrowUp" },
    { focused: "#sw-blue" },
    { key: "ArrowLeft" },
    { focused: "#sw-green" },
    // homeEnd: false: not handled.
    { key: "End" },
    { focused: "#sw-green" },
    { key: "Space" },
    { expect: ["#sw-value", "green"] },
  ],
});
