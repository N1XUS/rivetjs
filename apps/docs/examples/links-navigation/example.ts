import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Links and search params",
  summary: "Plain links swap pages without a full load and move focus to the new heading; buttons change the query with setSearchParams.",
  tags: ["routing", "links", "navigation"],
  frame: { height: "sm" },
  show: ["src/routes/products.tsx", "src/routes/_layout.tsx"],
  test: [
    { click: "#to-products" },
    { expect: ["h1", "Products"] },
    { focused: "h1" },
    { expect: ["title", "Products"] },
    { expect: ["#list", "Chair: 120 €Desk: 300 €Lamp: 40 €"] },
    { click: "#by-price" },
    { expect: ["#sorted", "Sorted by price."] },
    { expect: ["#list", "Lamp: 40 €Chair: 120 €Desk: 300 €"] },
    { click: "#to-home" },
    { expect: ["h1", "Home"] },
  ],
});
