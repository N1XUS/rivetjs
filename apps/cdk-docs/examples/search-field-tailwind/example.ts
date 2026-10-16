import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "SearchField: Tailwind",
  summary: "Tailwind utilities on each part; `group-data-[empty]:` hides the clear button, a class function reads the render props.",
  tags: ["search-field", "tailwind", "styling"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "div.group[data-empty]:has(#q)" },
    { matches: "div.group.is-empty:has(#q)" },
    { fill: ["#q", "dialog"] },
    { absent: "div.group[data-empty]:has(#q)" },
    { absent: "div.group.is-empty:has(#q)" },
    { press: ["#q", "Escape"] },
    { attr: ["#q", "value", ""] },
  ],
});
