import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Show and hide",
  summary: "Render a part of the page only when a signal says so, and switch between two branches.",
  tags: ["conditional", "signals"],
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#toggle", "Show details"] },
    { click: "#toggle" },
    { expect: ["#details", "Details are visible now."] },
    { expect: ["#toggle", "Hide details"] },
    { click: "#plan" },
    { expect: ["#price", "Pro: $9 a month"] },
    { fill: ["#note", "kept"] },
    { click: "#plan" },
    { expect: ["#price", "Free plan"] },
    { click: "#toggle" },
    { expect: ["#toggle", "Show details"] },
  ],
});
