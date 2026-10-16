import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Drag-free carousel",
  summary: "embla's Drag Free example: dragFree keeps the momentum of a flick and lands wherever it stops; the buttons still step snap by snap.",
  tags: ["carousel", "drag", "tailwind"],
  status: "experimental",
  frame: { height: 244, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { expect: ["#snap", "1 / "] },
    { click: "#next" },
    { expect: ["#snap", "2 / "] },
    { drag: ["#free-slide-1", "#prev"] },
    { attr: ["#free", "data-dragging", null] },
  ],
});
