import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Virtualizer: sections",
  summary:
    'Items with type "section" hold a header node and their rows; ListLayout stacks headings (headingSize) and rows (rowSize), and children render nested in the section view.',
  tags: ["virtualizer", "list", "sections"],
  status: "experimental",
  frame: { height: 336, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: '#people [data-rv-view="A"][data-rv-type="section"]' },
    { matches: '#people [data-rv-view="A"] > [data-rv-view="A-header"][data-rv-type="header"]' },
    { expect: ['[data-rv-view="A-header"]', "Group A"] },
    { matches: '#people [data-rv-view="A"] > [data-rv-view="A-0"][data-rv-type="item"]' },
    // Children are positioned relative to their section: the first row sits under the 28px heading.
    { matches: '[data-rv-view="A-0"]:is([style*="top:28px"], [style*="top: 28px"])' },
    { absent: '#people [data-rv-view="Z"]' },
    { press: ["#people", "ArrowDown"] },
    { expect: ["#people-top", "40"] },
    { click: "#people-bottom" },
    { matches: '#people [data-rv-view="Z-header"]' },
    { matches: '#people [data-rv-view="Z-19"]' },
    { absent: '#people [data-rv-view="A"]' },
  ],
});
