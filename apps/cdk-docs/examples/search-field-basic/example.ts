import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "SearchField",
  summary: "A search input with a clear button: Enter submits, Escape clears.",
  tags: ["search-field", "forms"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#q", "type", "search"] },
    { name: ["#q", "Search"] },
    { fill: ["#q", "popover"] },
    { press: ["#q", "Enter"] },
    { expect: ["#submitted", "Submitted: popover"] },
    { key: "Escape" },
    { attr: ["#q", "value", ""] },
    // `class` replaces the default rv-SearchField class; state stays in data attributes.
    { matches: "div.grid[data-empty]:has(#q)" },
    { fill: ["#q", "dialog"] },
    { absent: "div.grid[data-empty]:has(#q)" },
    { click: 'button[aria-label="Clear search"]' },
    { attr: ["#q", "value", ""] },
    { focused: "#q" },
  ],
});
