import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ListBox orientation and layout",
  summary: 'orientation="horizontal" moves with ArrowLeft and ArrowRight; layout="grid" moves by rendered rows and columns.',
  tags: ["listbox", "keyboard", "layout"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#sizes", "aria-orientation", "horizontal"] },
    { attr: ["#sizes", "data-orientation", "horizontal"] },
    // Replace behaviour: the selection follows focus.
    { press: ["#sizes-option-m", "ArrowRight"] },
    { focused: "#sizes-option-l" },
    { expect: ["#size-value", "Size: l"] },
    { key: "ArrowLeft" },
    { key: "ArrowLeft" },
    { focused: "#sizes-option-s" },
    { expect: ["#size-value", "Size: s"] },
    // Grid: three columns.
    { attr: ["#swatches", "data-layout", "grid"] },
    { press: ["#swatches-option-red", "ArrowDown"] },
    { focused: "#swatches-option-green" },
    { key: "ArrowRight" },
    { focused: "#swatches-option-blue" },
    { key: "ArrowUp" },
    { focused: "#swatches-option-orange" },
  ],
});
