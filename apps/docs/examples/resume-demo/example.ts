import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Resume demo",
  summary: "The component runs once to make the HTML. In the browser only the click handler runs, so the render time stays the same.",
  tags: ["resume", "signals"],
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#count", "Count: 0"] },
    { click: "#add" },
    { expect: ["#count", "Count: 1"] },
    { click: "#add" },
    { expect: ["#count", "Count: 2"] },
    { expect: ["#rendered", "Component ran at"] },
  ],
});
