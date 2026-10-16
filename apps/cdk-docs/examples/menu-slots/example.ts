import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Menu item content",
  summary:
    "Text slots (label, description) and Keyboard (shortcut) inside each MenuItem wire aria-labelledby / aria-describedby; an icon trigger takes its name from aria-label.",
  tags: ["menu", "slots"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { name: ["#s-trigger", "More actions"] },
    { press: ["#s-trigger", "Enter"] },
    { expect: ['[data-key="new"] [slot="description"]', "Start from scratch"] },
    { expect: ['[data-key="new"] kbd', "Ctrl+N"] },
    { attr: ["#s", "aria-labelledby", "s-trigger"] },
    // Typeahead reads the item's textValue.
    { key: "s" },
    { focused: '[data-key="save"]' },
    { key: "Enter" },
    { expect: ["#s-value", "save"] },
  ],
});
