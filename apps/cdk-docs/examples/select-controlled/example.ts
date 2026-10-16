import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Controlled Select",
  summary: "value and isOpen as two-way signals: buttons set, clear and open the select; a second select starts from defaultValue.",
  tags: ["select", "controlled", "signals"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#size-value", "Medium"] },
    { expect: ["#fit-value", "Small"] },
    // isOpen opens the popover; the listbox focuses the selected option.
    { click: "#open-size" },
    { matches: "#size-listbox" },
    { expect: ["#size-out", "open: true"] },
    { focused: "#size-listbox-option-m" },
    // Selecting writes both signals back.
    { key: "ArrowDown" },
    { key: "Enter" },
    { absent: "#size-listbox" },
    { expect: ["#size-out", "value: l, open: false"] },
    { expect: ["#size-value", "Large"] },
    // Programmatic value changes reach the trigger and the hidden select.
    { click: "#pick-none" },
    { expect: ["#size-value", "Select an item"] },
    { matches: "#size-value[data-placeholder]" },
    { expect: ["#size-out", "value: null, open: false"] },
    { click: "#pick-large" },
    { expect: ["#size-value", "Large"] },
    // The trigger opens on the current value.
    { click: "#size-trigger" },
    { attr: ["#size-listbox-option-l", "aria-selected", "true"] },
    { key: "Escape" },
    { absent: "#size-listbox" },
    // The uncontrolled select keeps its own value.
    { click: "#fit-trigger" },
    { click: "#fit-listbox-option-l" },
    { expect: ["#fit-value", "Large"] },
    { expect: ["#size-out", "value: l"] },
  ],
});
