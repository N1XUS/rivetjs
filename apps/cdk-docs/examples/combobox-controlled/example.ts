import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ComboBox: controlled",
  summary: "Two-way signals for the selected key and the input text; with both controlled, `onSelectionChange` writes the text. Buttons set them from outside.",
  tags: ["combobox", "controlled"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#city", "value", "Lisbon"] },
    { expect: ["#value", "Key: lis · Text: Lisbon"] },
    { click: "#pick-zur" },
    { expect: ["#value", "Key: zur · Text: Zürich"] },
    { fill: ["#city", "ber"] },
    { expect: ["#value", "Text: ber"] },
    { key: "ArrowDown" },
    { key: "Enter" },
    { expect: ["#value", "Key: ber · Text: Berlin"] },
    { click: "#clear" },
    { expect: ["#value", "Key: none · Text: "] },
  ],
});
