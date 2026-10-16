import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ListKeyboardDelegate grid",
  summary:
    "React Aria's ListKeyboardDelegate in grid layout: arrows follow the rendered rows and columns, disabled keys are skipped, typeSelectKeyDown searches.",
  tags: ["keyboard", "selection", "react-aria"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { press: ['[data-key="apple"]', "ArrowRight"] },
    { focused: '[data-key="banana"]' },
    // Down: the item below in the same column (measured from the DOM).
    { key: "ArrowDown" },
    { focused: '[data-key="elderberry"]' },
    { key: "ArrowDown" },
    { focused: '[data-key="kiwi"]' },
    // Left of Kiwi is Grape, a disabled key: skipped, back to Fig.
    { key: "ArrowLeft" },
    { focused: '[data-key="fig"]' },
    { key: "ArrowUp" },
    { focused: '[data-key="cherry"]' },
    { key: "End" },
    { focused: '[data-key="lemon"]' },
    { key: "Home" },
    { focused: '[data-key="apple"]' },
    // typeSelectKeyDown: the next item whose text starts with the typed letters.
    { key: "d" },
    { focused: '[data-key="date"]' },
    { expect: ["#dg-typed", "date"] },
  ],
});
