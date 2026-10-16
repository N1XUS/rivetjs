import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Overflow: collapsing toolbar",
  summary: 'createOverflow({ collapse: "end" }) keeps the toolbar buttons that fit and lists the rest in a "More" menu; resize the box (drag its corner).',
  tags: ["overflow", "toolbar", "menu"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    // 300px box: the first actions + "More".
    { matches: "#editor-actions > button[aria-label='More actions']" },
    { absent: "#editor-actions > button[data-action='archive']" },
    { click: "#editor-actions button[aria-label='More actions']" },
    { matches: "#more-actions [role=menuitem][data-key='archive']" },
    { click: "#more-actions [role=menuitem][data-key='archive']" },
    { absent: "#more-actions" },
    { expect: ["#last-action", "Last action: Archive"] },
  ],
});
