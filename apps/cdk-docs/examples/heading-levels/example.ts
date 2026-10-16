import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Heading levels and context",
  summary: "Heading renders h1\u2013h6 from level (default 3); a HeadingContext value sets level, class and even reactive children for every Heading inside.",
  tags: ["heading", "context"],
  status: "experimental",
  frame: { height: 213, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "h3#h-default.rv-Heading" },
    { matches: "h1#h-one" },
    { matches: "h2#h-ctx.section-title" },
    { expect: ["#h-live", "Step 1"] },
    { click: "#h-next" },
    { expect: ["#h-live", "Step 2"] },
  ],
});
