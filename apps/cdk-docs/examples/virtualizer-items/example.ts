import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Virtualizer: reactive items",
  summary: "items as an accessor: filtering the list re-renders the window, rows are keyed by getKey, and the content size follows the new length.",
  tags: ["virtualizer", "list", "signals"],
  status: "experimental",
  frame: { height: 363, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { expect: ["#products-count", "10000 of 10000"] },
    { matches: '#products [data-rv-view="sku-0"]' },
    // Start the engine with a first scroll (see the page's known limitations), then filter.
    { press: ["#products", "ArrowDown"] },
    { expect: ["#products-top", "scrollTop: 40"] },
    { fill: ["#products-filter", "123"] },
    { expect: ["#products-count", "20 of 10000"] },
    { matches: '#products [data-rv-view="sku-123"]' },
    { matches: '#products [data-rv-view="sku-1123"]:is([style*="top: 32px"], [style*="top:32px"])' },
    { absent: '#products [data-rv-view="sku-0"]' },
    { matches: '#products .rv-Virtualizer-content[style*="height: 640px"]' },
    { fill: ["#products-filter", "12"] },
    { expect: ["#products-count", "299 of 10000"] },
    { matches: '#products [data-rv-view="sku-121"]' },
    { fill: ["#products-filter", ""] },
    { matches: '#products [data-rv-view="sku-0"]' },
    { expect: ["#products-count", "10000 of 10000"] },
  ],
});
