import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Autocomplete: command palette",
  summary: "A SearchField filtering a Menu: typing narrows the commands, arrow keys move virtual focus, Enter runs the focused command.",
  tags: ["autocomplete", "menu", "search-field"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#palette", "aria-autocomplete", "list"] },
    { fill: ["#palette", "file"] },
    { absent: '[role=menuitem][data-key="save"]' },
    { matches: '[role=menuitem][data-key="open"]' },
    // Typing forward virtually focuses the first match (upstream disableAutoFocusFirst = false); the input keeps DOM focus.
    { attr: ['[role=menuitem][data-key="new"]', "data-focused", "true"] },
    { matches: '#palette[aria-activedescendant$="-new"]' },
    { key: "ArrowDown" },
    { attr: ['[role=menuitem][data-key="open"]', "data-focused", "true"] },
    { focused: "#palette" },
    { key: "Enter" },
    { expect: ["#ran", "Ran: open"] },
  ],
});
