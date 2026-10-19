import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Virtualizer: Tree",
  summary:
    "A Tree of 100 expanded folders (1,000 rows) inside <CollectionVirtualizer layout={ListLayout}>: the layout runs over the flattened expanded rows; expanding and collapsing re-lays out the window.",
  tags: ["virtualizer", "tree", "collections"],
  status: "experimental",
  frame: { height: 336, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#files", "role", "treegrid"] },
    { matches: '#files [role=row][data-key="f1"]' },
    { attr: ['#files [role=row][data-key="f1-1"]', "aria-level", "2"] },
    { absent: '#files [role=row][data-key="f20"]' },
    { matches: '#files .rv-Virtualizer-content:is([style*="height:32000px"], [style*="height: 32000px"])' },
    // 1,600px = row 50: folder 6.
    { wheel: ["#files", 1600] },
    { matches: '#files [role=row][data-key="f6"]' },
    { absent: '#files [role=row][data-key="f1"]' },
    { click: '#files [role=row][data-key="f6-2"]' },
    { expect: ["#files-value", "Selected: f6-2"] },
    { key: "End" },
    { focused: '#files [role=row][data-key="f100-9"]' },
    { key: "Home" },
    { focused: '#files [role=row][data-key="f1"]' },
    // Collapse the first folder: its 9 files leave the flattened rows.
    { key: "ArrowLeft" },
    { attr: ['#files [role=row][data-key="f1"]', "aria-expanded", "false"] },
    { absent: '#files [role=row][data-key="f1-1"]' },
    { matches: '#files .rv-Virtualizer-content:is([style*="height:31712px"], [style*="height: 31712px"])' },
  ],
});
