import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ListKeyboardDelegate and type select",
  summary:
    "A ListKeyboardDelegate over the DOM collection answers getKeyBelow, getKeyAbove, getFirstKey and getLastKey; typeSelectKeyDown searches as you type.",
  tags: ["selection", "keyboard", "typeahead"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { press: ["#country-austria", "ArrowDown"] },
    { focused: "#country-belgium" },
    { key: "End" },
    { focused: "#country-denmark" },
    { key: "ArrowUp" },
    // Cyprus is disabled: skipped.
    { key: "ArrowUp" },
    { focused: "#country-croatia" },
    // Type select: "c" then "z" builds the search "cz".
    { key: "Home" },
    { key: "c" },
    { focused: "#country-croatia" },
    { key: "z" },
    { focused: "#country-czechia" },
    { expect: ["#search", 'Search: "cz"'] },
  ],
});
