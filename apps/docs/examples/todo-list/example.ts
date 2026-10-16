import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Todo list",
  summary: "Add, check off and remove items. The list is keyed, so each row keeps its DOM when others change.",
  tags: ["lists", "signals", "forms"],
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#left", "1 of 2 left"] },
    { fill: ["#new-todo", "Write docs"] },
    { click: "#add" },
    { expect: ["#todos", "Write docs"] },
    { expect: ["#left", "2 of 3 left"] },
    { click: "#todos li:first-child input" },
    { expect: ["#left", "3 of 3 left"] },
    { click: "#todos li:first-child button" },
    { expect: ["#left", "2 of 2 left"] },
  ],
});
