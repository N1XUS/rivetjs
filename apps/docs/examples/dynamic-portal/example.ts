import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Dynamic and Portal",
  summary: "Pick the element to render at runtime with Dynamic, and render a notice at the end of the body with Portal.",
  tags: ["components", "resume"],
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "h2#heading" },
    { click: "#level" },
    { matches: "h3#heading" },
    { expect: ["#heading", "Level 3 heading"] },
    { absent: "body > [data-rivet-portal] #notice" },
    { click: "#open" },
    { expect: ["body > [data-rivet-portal] #notice", "Saved"] },
    { click: "#close" },
    { absent: "#notice" },
  ],
});
