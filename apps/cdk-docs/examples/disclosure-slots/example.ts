import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Disclosure: content",
  summary: "Rich trigger content (icon and a reactive badge) and an interactive panel: handlers in the panel resume on first use.",
  tags: ["cdk", "disclosure"],
  status: "experimental",
  frame: { height: 128, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#badge", "1 item"] },
    { click: "#add" },
    { expect: ["#badge", "2 items"] },
    { matches: "#order[data-expanded]" },
    { click: "#order h3 button" },
    { matches: "#order:not([data-expanded])" },
  ],
});
