import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Resumable callbacks",
  summary:
    "Callbacks written as an inline arrow or a local constant work on a server-rendered page: the first press runs the component over its HTML, then the callback.",
  tags: ["resumability", "button", "listbox"],
  status: "experimental",
  frame: { height: 208, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { expect: ["#log", "nothing yet"] },
    { click: "#ping" },
    { expect: ["#log", "Button onPress(mouse)"] },
    { press: ["#mute", "Enter"] },
    { expect: ["#log", "ToggleButton onChange(true)"] },
    { attr: ["#mute", "aria-pressed", "true"] },
    { click: '#color [data-key="green"]' },
    { expect: ["#log", "ListBox onSelectionChange(green)"] },
    { key: "ArrowDown" },
    { key: "Space" },
    { expect: ["#log", "ListBox onSelectionChange(blue)"] },
  ],
});
