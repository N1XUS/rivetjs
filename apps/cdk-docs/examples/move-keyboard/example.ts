import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "moveProps",
  summary: "A handle moved by dragging or the arrow keys: movestart, move with deltas, moveend; a plain click is no move.",
  tags: ["cdk", "interactions", "move"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#pos", "x 40, y 40"] },
    // A click without movement fires nothing.
    { click: "#handle" },
    { expect: ["#log", "none"] },
    { press: ["#handle", "ArrowRight"] },
    { expect: ["#pos", "x 50, y 40"] },
    { expect: ["#log", "movestart:keyboard move:keyboard(1,0) moveend:keyboard"] },
    { key: "ArrowDown" },
    { expect: ["#pos", "x 50, y 50"] },
    // Shift: bigger steps.
    { key: "Shift+ArrowLeft" },
    { expect: ["#pos", "x 0, y 50"] },
  ],
});
