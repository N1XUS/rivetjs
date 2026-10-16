import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RadioGroup events",
  summary: "onChange with the selected value, group focus-within events (onFocus, onBlur, onFocusChange) and per-radio focus and key events on the items.",
  tags: ["radio-group", "events"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { click: "#pet-dog" },
    { expect: ["#rg-log", "group:focus"] },
    { expect: ["#rg-log", "within:true"] },
    { expect: ["#rg-log", "dog:focus:true"] },
    { expect: ["#rg-log", "change:dog"] },
    { key: "ArrowDown" },
    { expect: ["#rg-log", "dog:keydown:ArrowDown"] },
    { expect: ["#rg-log", "change:cat"] },
    { key: "Tab" },
    { expect: ["#rg-log", "within:false"] },
    { expect: ["#rg-log", "group:blur"] },
  ],
});
