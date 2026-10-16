import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ToggleButtonGroup (single selection)",
  summary: "A radiogroup of ToggleButtons with ids: one selected at a time, arrow keys move focus, onSelectionChange reports the Set of keys.",
  tags: ["toggle-button-group", "selection"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [
    { attr: ["#view", "role", "radiogroup"] },
    { attr: ["#view button:nth-child(1)", "aria-checked", "true"] },
    { click: "#view button:nth-child(2)" },
    { attr: ["#view button:nth-child(2)", "aria-checked", "true"] },
    { attr: ["#view button:nth-child(1)", "aria-checked", "false"] },
    { expect: ["#view-value", "Selected: grid"] },
    { key: "ArrowRight" },
    { focused: "#view button:nth-child(3)" },
    { key: "Space" },
    { expect: ["#view-value", "Selected: gallery"] },
    { click: "#view button:nth-child(3)" },
    { expect: ["#view-value", "Selected: none"] },
  ],
});
