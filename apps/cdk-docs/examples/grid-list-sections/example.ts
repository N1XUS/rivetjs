import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "GridList: sections",
  summary: "GridListSection groups rows (role rowgroup), named by a GridListHeader row or by aria-label; arrow keys cross sections.",
  tags: ["grid-list", "sections"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "#produce > [role=rowgroup][data-key=fruit] > [role=row] > [role=rowheader]" },
    { name: ["#produce [data-key=fruit]", "Fruit"] },
    { attr: ["#produce [data-key=vegetables]", "aria-label", "Vegetables"] },
    { press: ["#produce-peach", "ArrowDown"] },
    { focused: "#produce-broccoli" },
    { key: "ArrowUp" },
    { focused: "#produce-peach" },
    { key: "End" },
    { focused: "#produce-peas" },
  ],
});
