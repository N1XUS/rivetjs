import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "MenuSection: Section Selection",
  summary:
    "Two MenuSections with their own selection in one Menu: a single-choice sort section (dot indicators) and a multiple-choice columns section (check marks), each bound to a Signal.",
  tags: ["menu", "menu-section", "selection"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#menu-view-state", "Sort: date · Columns: owner, size"] },
    { click: '#menu-view [data-key="name"]' },
    { attr: ['#menu-view [data-key="name"]', "aria-checked", "true"] },
    { expect: ["#menu-view-state", "Sort: name"] },
    { click: '#menu-view [data-key="tags"]' },
    { expect: ["#menu-view-state", "Columns: owner, size, tags"] },
    { click: '#menu-view [data-key="owner"]' },
    { expect: ["#menu-view-state", "Columns: size, tags"] },
    { attr: ['#menu-view [data-key="date"]', "aria-checked", "false"] },
  ],
});
