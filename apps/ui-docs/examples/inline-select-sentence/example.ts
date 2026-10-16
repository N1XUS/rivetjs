import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "InlineSelect: In a Sentence",
  summary: "Several InlineSelects inside running text: the triggers keep the paragraph's font and line height.",
  tags: ["inline-select"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "[data-slot=inline-select]:nth-of-type(2) [data-slot=inline-select-trigger]" },
    { click: "[role=option][data-key=team]" },
    { expect: ["[data-slot=inline-select]:nth-of-type(2) .inline-select__value", "my team"] },
  ],
});
