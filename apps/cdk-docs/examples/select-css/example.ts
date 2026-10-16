import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Select with CSS",
  summary: "A plain stylesheet on the default rv-* class names and the data-* / aria-* state attributes, with an enter / exit animation.",
  tags: ["select", "css", "styling"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [
    { matches: "#city.rv-Select" },
    { matches: "#city-trigger.rv-Select-trigger" },
    { matches: "#city-value.rv-SelectValue[data-placeholder]" },
    { matches: "#bad.rv-Select[data-invalid][data-required]" },
    { expect: ["#bad-trigger-error.rv-FieldError", "Pick a city."] },
    // Keyboard focus: data-focused and data-focus-visible on the root.
    { press: ["#city-trigger", "Shift"] },
    { matches: "#city[data-focused][data-focus-visible]" },
    { key: "ArrowDown" },
    { matches: "#city[data-open]" },
    { matches: "#city-popover.rv-Select-popover" },
    { matches: "#city-listbox.rv-ListBox" },
    { matches: "#city-listbox-option-oslo.rv-ListBoxItem[data-focused]" },
    { attr: ["#city-listbox-option-tokyo", "aria-disabled", "true"] },
    { key: "Enter" },
    { absent: "#city-popover" },
    { expect: ["#city-value", "Oslo"] },
  ],
});
