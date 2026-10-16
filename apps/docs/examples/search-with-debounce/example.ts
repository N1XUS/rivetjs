import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Search with debounce",
  summary: "A search box that filters a list 250 ms after you stop typing, not on every key press.",
  tags: ["signals", "client-effect", "lists", "forms"],
  frame: { height: "lg" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#count", "12 of 12"] },
    { fill: ["#search", "an"] },
    { expect: ["#count", "3 of 12"] },
    { expect: ["#results", "Banana"] },
    { fill: ["#search", "zzz"] },
    { expect: ["#count", "0 of 12"] },
  ],
});
