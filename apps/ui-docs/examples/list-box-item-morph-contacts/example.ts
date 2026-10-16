import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ListBox: Item Morph (contact preview)",
  summary: "Rivet-authored: press and hold a contact (or right click, Shift+F10) and the row lifts into a preview card with actions; Escape morphs it back.",
  tags: ["list-box", "item-morph", "morph"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [
    { absent: "[data-morph-surface]" },
    { longpress: '[role=option][data-key="fred"]' },
    { name: ["[data-morph-surface][role=dialog]", "Fred"] },
    { expect: ["[data-morph-surface]", "fred@acme.com"] },
    { focused: "#contact-call" },
    { expect: ["p.text-sm", "Selected: none"] },
    { key: "Escape" },
    { absent: "[data-morph-surface]" },
    { focused: '[role=option][data-key="fred"]' },
    { rightclick: '[role=option][data-key="martha"]' },
    { expect: ["[data-morph-surface]", "martha@acme.com"] },
    { key: "Escape" },
    { absent: "[data-morph-surface]" },
    { click: '[role=option][data-key="bob"]' },
    { expect: ["p.text-sm", "Selected: bob"] },
  ],
});
