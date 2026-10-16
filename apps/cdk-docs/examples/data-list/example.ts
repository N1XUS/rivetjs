import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "createListData",
  summary: "A ListBox over createListData: append, remove the selection, move to the top, update an item and filter, with a two-way selectedKeys signal.",
  tags: ["data", "list", "listbox"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#animals-option-2", "aria-selected", "true"] },
    { expect: ["#animals-count", "4 items"] },
    // append
    { click: "#animals-add" },
    { expect: ["#animals-option-5", "Animal 5"] },
    { expect: ["#animals-count", "5 items"] },
    // move the selection to the top (moveBefore the first key)
    { click: "#animals-option-4" },
    { click: "#animals-top" },
    { matches: "#animals > [role=option]:first-child#animals-option-2" },
    { matches: "#animals > [role=option]:nth-child(2)#animals-option-4" },
    // update (a function of the previous value)
    { click: "#animals-shout" },
    { expect: ["#animals-option-2", "KANGAROO"] },
    // remove the selected items
    { click: "#animals-remove" },
    { absent: "#animals-option-2" },
    { absent: "#animals-option-4" },
    { expect: ["#animals-count", "3 items"] },
    { expect: ["#animals-selection", "Selected: none"] },
    // filter (items() filtered, getItem still sees all)
    { fill: ["#animals-filter", "aa"] },
    { expect: ["#animals-count", "1 items"] },
    { expect: ["#animals-option-1", "Aardvark"] },
    { absent: "#animals-option-3" },
  ],
});
