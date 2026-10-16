import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Card slots",
  summary: "A Card component with a named header slot, a default slot, a footer slot and a scoped slot for rows.",
  tags: ["slots", "components"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/components/Card.tsx"],
  test: [
    { expect: ["#cards article:first-child h2", "Slots in Rivet"] },
    { expect: ["#cards article:last-child h2", "Untitled card"] },
    { expect: ["#cards article:last-child footer", "No footer"] },
    { click: "#like" },
    { expect: ["#like", "Like (1)"] },
    { click: "#cards article:first-child header button" },
    { expect: ["#cards article:first-child ul", "2. Scoped slots"] },
  ],
});
