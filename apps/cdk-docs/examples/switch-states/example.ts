import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Disabled, read-only and invalid Switch",
  summary: "isDisabled, isReadOnly (focusable, keeps its value), isInvalid on a SwitchField and excludeFromTabOrder.",
  tags: ["switch", "disabled", "read-only"],
  status: "experimental",
  frame: { height: 184, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#sw-off", "disabled", ""] },
    { matches: "label[data-disabled]:has(#sw-off)" },
    { attr: ["#sw-ro", "aria-readonly", "true"] },
    { click: "label:has(#sw-ro)" },
    { matches: "#sw-ro:checked" },
    { attr: ["#sw-bad", "aria-invalid", "true"] },
    { matches: "label[data-invalid]:has(#sw-bad)" },
    { attr: ["#sw-skip", "tabindex", "-1"] },
    { press: ["#sw-ro", "Tab"] },
    { focused: "#sw-bad" },
    { key: "Tab" },
    { focused: "#sw-last" },
  ],
});
