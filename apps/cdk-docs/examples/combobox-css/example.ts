import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ComboBox: plain CSS",
  summary: "Default `rv-*` classes and `data-*` state attributes styled with plain CSS.",
  tags: ["combobox", "css", "styling"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [{ fill: ["#city", "a"] }, { matches: '.rv-ComboBox[data-open="true"]' }, { key: "ArrowDown" }, { matches: ".rv-ListBoxItem[data-focused]" }],
});
