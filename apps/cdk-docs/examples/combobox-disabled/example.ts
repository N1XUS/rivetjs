import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ComboBox: disabled",
  summary: "`disabledKeys` keeps Madrid visible but not selectable; `isDisabled` disables the whole second combo box.",
  tags: ["combobox", "disabled"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { fill: ["#city", "ma"] },
    { attr: ['[role=option][data-key="mad"]', "aria-disabled", "true"] },
    { attr: ["#off", "disabled", ""] },
  ],
});
