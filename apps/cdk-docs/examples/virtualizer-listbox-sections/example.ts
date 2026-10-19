import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Virtualizer: ListBox sections",
  summary:
    "20 ListBox sections of 50 options inside <CollectionVirtualizer layout={ListLayout}>: sections and their headers render with their window, options count their position per section.",
  tags: ["virtualizer", "listbox", "sections", "collections"],
  status: "experimental",
  frame: { height: 336, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    // Server window: the first section (its header + the options in view); positions count per section.
    { matches: "#teams [role=group] header" },
    { attr: ['#teams [role=option][data-key="t1-1"]', "aria-posinset", "1"] },
    { attr: ['#teams [role=option][data-key="t1-1"]', "aria-setsize", "50"] },
    { absent: '#teams [role=option][data-key="t2-1"]' },
    // 1,628px per section (a 28px header + 50 x 32px options): the wheel lands in section 2.
    { wheel: ["#teams", 1700] },
    { matches: '#teams [role=option][data-key="t2-3"]' },
    { absent: '#teams [role=option][data-key="t1-1"]' },
    { click: '#teams [role=option][data-key="t2-3"]' },
    { expect: ["#teams-value", "Selected: t2-3"] },
    { key: "End" },
    { focused: '#teams [role=option][data-key="t20-50"]' },
    { attr: ['#teams [role=option][data-key="t20-50"]', "aria-posinset", "50"] },
    { key: "Home" },
    { focused: '#teams [role=option][data-key="t1-1"]' },
  ],
});
