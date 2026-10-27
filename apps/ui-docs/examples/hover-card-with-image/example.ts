import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "HoverCard: With Image",
  summary: "A link preview: cover image, title and summary of the page behind the link.",
  tags: ["hover-card"],
  status: "experimental",
  frame: { height: 380 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      hover: "#hc-image a",
    },
    {
      matches: "[data-slot=hover-card-content] img",
    },
  ],
});
