import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ListBox: Item Morph (inline settings)",
  summary: 'Rivet-authored: a press on a settings row (trigger "press") morphs it into its settings panel over a transparent backdrop; Done morphs it back.',
  tags: ["list-box", "item-morph", "morph", "switch"],
  status: "experimental",
  frame: { height: 400 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: '[role=option][data-key="wifi"]' },
    { name: ["[data-morph-surface][role=dialog]", "Wi-Fi"] },
    { expect: ["[data-morph-surface]", "Ask to join networks"] },
    { click: "[data-morph-surface] [data-slot=switch-content]" },
    { click: "[data-slot=item-morph-close]" },
    { absent: "[data-morph-surface]" },
    { expect: ['[role=option][data-key="wifi"]', "Off"] },
    { press: ['[role=option][data-key="wifi"]', "ArrowDown"] },
    { key: "Enter" },
    { expect: ["[data-morph-surface]", "Allow notifications"] },
    { key: "Escape" },
    { absent: "[data-morph-surface]" },
  ],
});
