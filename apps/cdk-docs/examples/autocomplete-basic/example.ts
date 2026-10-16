import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Autocomplete",
  summary: "A SearchField filtering a ListBox: arrow keys move virtual focus through the options while DOM focus stays in the input.",
  tags: ["autocomplete", "search-field", "listbox"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { fill: ["#cmd", "file"] },
    { matches: '[role=option][data-key="open"]' },
    { focused: "#cmd" },
    { attr: ["#cmd", "aria-controls", "cmds"] },
    { absent: '[role=option][data-key="save"]' },
    { key: "ArrowDown" },
    { attr: ['[role=option][data-key="new"]', "data-focused", "true"] },
    { attr: ["#cmd", "aria-activedescendant", "cmds-option-new"] },
  ],
});
