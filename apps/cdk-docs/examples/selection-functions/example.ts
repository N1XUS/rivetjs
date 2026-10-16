import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Selection helpers",
  summary: "createSelection with selectKey, toggleSingle, firstSelected and extendTo (the range from the anchor; Shift+click or the button).",
  tags: ["selection", "collections"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#single-tue" },
    { expect: ["#single-value", "firstSelected: tue"] },
    { click: "#single-thu" },
    { expect: ["#single-value", "firstSelected: thu"] },
    { attr: ["#single-tue", "aria-pressed", "false"] },
    // toggleSingle: pressing the selected key again clears it.
    { click: "#single-thu" },
    { expect: ["#single-value", "firstSelected: null"] },
    { attr: ["#multi-mon", "aria-pressed", "true"] },
    // selectKey toggles in multiple mode and moves the anchor to "tue".
    { click: "#multi-tue" },
    { expect: ["#multi-value", "mon, tue"] },
    { click: "#multi-mon" },
    { expect: ["#multi-value", "tue"] },
    // The anchor is "mon" (the last key passed to selectKey): extendTo adds mon..fri.
    { click: "#extend-fri" },
    { expect: ["#multi-value", "mon, tue, wed, thu, fri"] },
  ],
});
