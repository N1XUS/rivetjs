import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ComboBox: sections and content",
  summary: "Static items in sections with headers, rich option content (`textValue` for filtering) and a description slot.",
  tags: ["combobox", "sections", "slots"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { described: ["#food", "Fruit or vegetable"] },
    { fill: ["#food", "p"] },
    { matches: '[role=option][data-key="apple"]' },
    { matches: '[role=option][data-key="pepper"]' },
    { absent: '[role=option][data-key="banana"]' },
  ],
});
