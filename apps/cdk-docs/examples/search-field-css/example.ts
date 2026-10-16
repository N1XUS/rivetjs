import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "SearchField: plain CSS",
  summary: "Plain CSS on the default `rv-SearchField` / `rv-Input` / `rv-Button` classes; `[data-empty]` hides the clear button.",
  tags: ["search-field", "css", "styling"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: ".rv-SearchField[data-empty]:has(#q)" },
    { fill: ["#q", "grid"] },
    { absent: ".rv-SearchField[data-empty]:has(#q)" },
    { matches: ".rv-SearchField .rv-Button" },
  ],
});
