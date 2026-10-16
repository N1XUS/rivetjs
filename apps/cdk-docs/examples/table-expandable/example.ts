import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Table: expandable rows",
  summary: "Nested rows with treeColumn (role treegrid): a chevron button per parent row, an expandedKeys signal, ArrowRight / ArrowLeft expand and collapse.",
  tags: ["table", "tree", "expand"],
  status: "experimental",
  frame: { height: 177, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#tree", "role", "treegrid"] },
    { attr: ["#tree tr[data-key=documents]", "aria-expanded", "true"] },
    { attr: ["#tree tr[data-key=documents]", "aria-level", "1"] },
    { attr: ["#tree tr[data-key=project]", "aria-level", "2"] },
    { attr: ["#tree tr[data-key=project]", "aria-expanded", "false"] },
    { absent: "#tree tr[data-key=weekly]" },
    { attr: ["#tree tr[data-key=photos]", "aria-expanded", "false"] },
    { click: "#tree tr[data-key=photos] [slot=chevron]" },
    { attr: ["#tree tr[data-key=photos]", "aria-expanded", "true"] },
    { expect: ["#tree tr[data-key=image]", "Image 1"] },
    { expect: ["#tree-expanded", "Expanded: documents, photos"] },
    { press: ["#tree tr[data-key=project]", "ArrowRight"] },
    { attr: ["#tree tr[data-key=project]", "aria-expanded", "true"] },
    { expect: ["#tree tr[data-key=weekly]", "Weekly Report"] },
    { key: "ArrowLeft" },
    { attr: ["#tree tr[data-key=project]", "aria-expanded", "false"] },
  ],
});
