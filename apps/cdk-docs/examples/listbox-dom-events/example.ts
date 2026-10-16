import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ListBox DOM events and attributes",
  summary:
    "Global DOM events and attributes on the listbox (onClick runs after the selection), on items and on sections: lang, onPointerEnter, onDblClick, onContextMenu.",
  tags: ["listbox", "events", "dom"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#words", "lang", "en"] },
    { attr: ["#words-option-bonjour", "lang", "fr"] },
    { attr: ["#words section", "lang", "it"] },
    // The ListBox owns click: its selection runs first, then your handler.
    { click: "#words-option-hallo" },
    { attr: ["#words-option-hallo", "aria-selected", "true"] },
    { expect: ["#log", "list click"] },
    // Moving onto an item fires its own pointerenter.
    { click: "#words-option-ciao" },
    { expect: ["#log", "ciao pointerenter"] },
    { attr: ["#words-option-ciao", "aria-selected", "true"] },
  ],
});
