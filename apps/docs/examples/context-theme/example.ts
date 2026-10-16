import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Context theme",
  summary: "A Provider shares a theme signal with cards deep in the tree; they read it with useContext.",
  tags: ["context", "signals"],
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/components/theme.tsx"],
  test: [
    { expect: ["#cards", "Theme: light"] },
    { click: "#toggle" },
    { expect: ["#cards article:last-child .card-theme", "Theme: dark"] },
    { click: "#toggle" },
    { expect: ["#cards article:first-child .card-theme", "Theme: light"] },
  ],
});
