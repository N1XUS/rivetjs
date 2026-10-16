import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Nested layouts",
  summary: "A root layout wraps a group layout, which wraps the page. Each layout keeps its own state.",
  tags: ["routing", "layouts"],
  frame: { height: "sm" },
  show: ["src/routes/_layout.tsx", "src/routes/(shop)/_layout.tsx", "src/routes/(shop)/index.tsx"],
  test: [
    { expect: ["#page-title", "Products"] },
    { click: "#cart" },
    { expect: ["#cart", "Cart: 1"] },
    { click: "#filter" },
    { expect: ["#filter", "Only in stock: on"] },
  ],
});
