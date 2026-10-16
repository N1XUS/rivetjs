import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "SelectionManager on a custom list",
  summary:
    "createMultipleSelectionState + SelectionManager over the DOM collection, with the selectable-list and selectable-item handlers: replace behaviour, ranges, wrapping, disabled keys.",
  tags: ["selection", "react-aria"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/lib/list.ts"],
  test: [
    { attr: ["#song-blue", "tabindex", "0"] },
    { attr: ["#song-freddie", "aria-disabled", "true"] },
    // replace: the selection follows focus.
    { click: "#song-blue" },
    { expect: ["#playlist-value", "Selected: blue"] },
    { key: "ArrowDown" },
    { focused: "#song-so" },
    { expect: ["#playlist-value", "Selected: so"] },
    // Shift extends past the disabled key.
    { key: "Shift+ArrowDown" },
    { focused: "#song-blues" },
    { expect: ["#playlist-value", "Selected: blues, so"] },
    // shouldFocusWrap: down from the last goes to the first.
    { key: "ArrowDown" },
    { focused: "#song-blue" },
    { expect: ["#playlist-value", "Selected: blue"] },
    // Typeahead (useTypeSelect) is part of the list keydown.
    { key: "s" },
    { focused: "#song-so" },
    { key: "Escape" },
    { expect: ["#playlist-value", "Selected: none"] },
  ],
});
