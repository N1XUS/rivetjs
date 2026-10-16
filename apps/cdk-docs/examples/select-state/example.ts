import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Select with shared state",
  summary: "createSelectState shared by the Select and outside buttons: setSelectValue sets or clears the value, openSelect opens the list.",
  tags: ["select", "state"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#color-value", "Green"] },
    { expect: ["#color-out", "Green selected"] },
    // openSelect(state, "last"): the selected option takes focus (else the last one).
    { click: "#color-open" },
    { matches: "#color-listbox" },
    { focused: "#color-listbox-option-green" },
    { key: "ArrowDown" },
    { key: "Enter" },
    { absent: "#color-listbox" },
    { expect: ["#color-out", "Blue selected"] },
    { click: "#color-clear" },
    { expect: ["#color-value", "Select an item"] },
    { expect: ["#color-out", "nothing selected"] },
    { click: "#color-blue" },
    { expect: ["#color-value", "Blue"] },
    { expect: ["#color-out", "Blue selected"] },
  ],
});
