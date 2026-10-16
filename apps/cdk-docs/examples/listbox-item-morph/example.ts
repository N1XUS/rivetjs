import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ListBox item morph",
  summary: "Headless item morph: hold a file (or right click, Shift+F10) and the row morphs into a preview panel on the overlay layer; Escape morphs it back.",
  tags: ["listbox", "morph", "long-press"],
  status: "experimental",
  frame: { height: 360 },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { absent: "[data-morph-surface]" },
    { longpress: "#files-option-report" },
    { name: ["[data-morph-surface][role=dialog]", "report.pdf"] },
    { expect: ["[data-morph-surface]", "2.4 MB"] },
    { attr: ["#files-option-report", "aria-selected", "false"] },
    { key: "Escape" },
    { absent: "[data-morph-surface]" },
    { focused: "#files-option-report" },
    { key: "ArrowDown" },
    { key: "Shift+F10" },
    { expect: ["[data-morph-surface]", "photo.jpg"] },
    { click: "#preview-close" },
    { absent: "[data-morph-surface]" },
  ],
});
