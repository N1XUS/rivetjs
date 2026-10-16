import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Motion basics",
  summary: "A card list slides in with CSS from the server, then a button animates the cards to a new target with Motion.",
  tags: ["motion", "animation", "resume"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#cards", "data-mve", null] },
    { matches: "#cards li[data-mvv]" },
    { click: "#toggle" },
    { expect: ["#toggle", "Show all"] },
    { click: "#toggle" },
    { expect: ["#toggle", "Dim the rest"] },
  ],
});
