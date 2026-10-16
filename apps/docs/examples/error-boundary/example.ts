import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Error boundary",
  summary: "A part of the page that fails shows a fallback with a retry button; the rest of the page keeps working.",
  tags: ["errors", "resume"],
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    // The server render failed inside the boundary: its fallback is in the HTML.
    { expect: ["#problem", "Stock cannot go below zero"] },
    { absent: "#stock" },
    { click: "#visits" },
    { expect: ["#visits", "Page still works: 1"] },
    // reset() renders the content again, now in the browser.
    { click: "#retry" },
    { expect: ["#stock", "2 in stock"] },
    { click: "#sell" },
    { click: "#sell" },
    { expect: ["#stock", "0 in stock"] },
    { click: "#sell" },
    { expect: ["#problem", "Stock cannot go below zero"] },
    { click: "#retry" },
    { expect: ["#stock", "2 in stock"] },
  ],
});
