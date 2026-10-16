import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Disabled Select",
  summary: "Disabled items (item.disabled, disabledKeys) are skipped by arrows and typeahead; isDisabled disables the trigger and the form value.",
  tags: ["select", "disabled"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#ship-trigger" },
    { attr: ["#ship-listbox-option-express", "aria-disabled", "true"] },
    { matches: "#ship-listbox-option-pickup[data-disabled]" },
    { focused: "#ship-listbox-option-standard" },
    // ArrowDown skips the disabled options.
    { key: "ArrowDown" },
    { focused: "#ship-listbox-option-overnight" },
    { key: "ArrowDown" },
    { focused: "#ship-listbox-option-overnight" },
    { expect: ["#ship-value", "Standard"] },
    { key: "Escape" },
    { absent: "#ship-listbox" },
    // Closed: ArrowRight skips disabled items too.
    { key: "ArrowRight" },
    { expect: ["#ship-value", "Overnight"] },
    // isDisabled: a disabled button, data-disabled on the root, a disabled hidden select.
    { attr: ["#locked-trigger", "disabled", ""] },
    { matches: ".rv-Select[data-disabled] #locked-trigger" },
    { attr: ["#locked-hidden", "disabled", ""] },
    { expect: ["#locked-value", "Overnight"] },
  ],
});
