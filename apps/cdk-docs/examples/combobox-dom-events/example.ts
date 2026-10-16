import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ComboBox: DOM events",
  summary: "Global DOM events on the root, input events on `<Input>`, list events on `<ListBox>`; the component's own handlers run first.",
  tags: ["combobox", "events", "dom"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { dblclick: ".rv-ComboBox" },
    { expect: ["#log", "root dblclick"] },
    { fill: ["#city", "a"] },
    { expect: ["#log", "input"] },
    { press: ["#city", "ArrowDown"] },
    { expect: ["#log", "keydown ArrowDown"] },
    { rightclick: "[role=listbox]" },
    { expect: ["#log", "list contextmenu"] },
  ],
});
